"""
Audio processing module for real-time viseme detection.

Processes raw audio data (PCM float32 or int16) to extract:
- RMS energy levels
- Peak detection for syllable boundaries
- Frequency band analysis for vowel/consonant discrimination
- Smoothed energy envelope for natural transitions
"""

import numpy as np
from scipy.signal import butter, lfilter
from typing import Optional


class AudioProcessor:
    def __init__(self, sample_rate: int = 44100, chunk_size: int = 1024):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size

        # Smoothing state
        self.smoothed_energy = 0.0
        self.alpha = 0.4  # EMA smoothing factor (lower = smoother, less twitchy)

        # Peak detection state
        self.peak_threshold = 0.08
        self.prev_energy = 0.0
        self.rising = False

        # Silence tracking
        self.silence_frames = 0
        self.silence_threshold = 0.02
        self.silence_timeout_frames = int(0.3 * sample_rate / chunk_size)  # ~300ms

        # Frequency band filters for vowel/consonant hints
        self._setup_filters()

    def _setup_filters(self):
        """Set up bandpass filters for frequency analysis."""
        nyquist = self.sample_rate / 2.0

        # Low band (vowels: 300-1000 Hz)
        low_lo = max(300 / nyquist, 0.01)
        low_hi = min(1000 / nyquist, 0.99)
        self.b_low, self.a_low = butter(2, [low_lo, low_hi], btype='band')

        # Mid band (formants/nasals: 1000-3000 Hz)
        mid_lo = max(1000 / nyquist, 0.01)
        mid_hi = min(3000 / nyquist, 0.99)
        self.b_mid, self.a_mid = butter(2, [mid_lo, mid_hi], btype='band')

        # High band (fricatives/sibilants: 3000-8000 Hz)
        high_lo = max(3000 / nyquist, 0.01)
        high_hi = min(8000 / nyquist, 0.99)
        self.b_high, self.a_high = butter(2, [high_lo, high_hi], btype='band')

    def process_chunk(self, audio_data: bytes, format: str = "float32") -> dict:
        """
        Process a chunk of raw audio data and return analysis results.

        Args:
            audio_data: Raw audio bytes
            format: "float32" (Web Audio default) or "int16" (WAV/MP3 decoded)

        Returns:
            dict with energy, peak, frequency bands, viseme_index, is_silent
        """
        samples = self._decode_audio(audio_data, format)
        if samples is None or len(samples) == 0:
            return self._silent_result()

        # Core energy analysis
        rms = self._compute_rms(samples)
        peak = self._compute_peak(samples)

        # Apply smoothing
        self.smoothed_energy = self.alpha * rms + (1 - self.alpha) * self.smoothed_energy

        # Peak detection (syllable boundaries)
        is_onset = self._detect_onset(self.smoothed_energy)

        # Frequency band analysis
        bands = self._analyze_frequency_bands(samples)

        # Silence tracking
        is_silent = self.smoothed_energy < self.silence_threshold
        if is_silent:
            self.silence_frames += 1
        else:
            self.silence_frames = 0

        sustained_silence = self.silence_frames >= self.silence_timeout_frames

        # Map to viseme
        viseme_index = self._energy_to_viseme(
            self.smoothed_energy, bands, sustained_silence
        )

        return {
            "rms": float(rms),
            "peak": float(peak),
            "smoothed_energy": float(self.smoothed_energy),
            "is_onset": is_onset,
            "bands": {
                "low": float(bands[0]),
                "mid": float(bands[1]),
                "high": float(bands[2]),
            },
            "is_silent": sustained_silence,
            "viseme_index": viseme_index,
            "confidence": min(1.0, self.smoothed_energy * 5),
        }

    def _silent_result(self) -> dict:
        """Return a result dict representing silence."""
        return {
            "rms": 0.0,
            "peak": 0.0,
            "smoothed_energy": 0.0,
            "is_onset": False,
            "bands": {"low": 0.0, "mid": 0.0, "high": 0.0},
            "is_silent": True,
            "viseme_index": 0,
            "confidence": 0.0,
        }

    def _decode_audio(self, audio_data: bytes, format: str) -> Optional[np.ndarray]:
        """Convert raw bytes to float32 numpy array normalized to [-1, 1]."""
        try:
            if format == "float32":
                samples = np.frombuffer(audio_data, dtype=np.float32)
            elif format == "int16":
                samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                return None

            if len(samples) == 0:
                return None

            # Clip to valid range
            return np.clip(samples, -1.0, 1.0)
        except (ValueError, TypeError):
            return None

    def _compute_rms(self, samples: np.ndarray) -> float:
        """Compute root-mean-square energy."""
        return float(np.sqrt(np.mean(samples ** 2)))

    def _compute_peak(self, samples: np.ndarray) -> float:
        """Compute peak amplitude."""
        return float(np.max(np.abs(samples)))

    def _detect_onset(self, current_energy: float) -> bool:
        """Detect syllable onsets using energy slope."""
        is_onset = False
        if current_energy > self.prev_energy + self.peak_threshold and not self.rising:
            is_onset = True
            self.rising = True
        elif current_energy < self.prev_energy:
            self.rising = False

        self.prev_energy = current_energy
        return is_onset

    def _analyze_frequency_bands(self, samples: np.ndarray) -> tuple:
        """Analyze energy in low/mid/high frequency bands."""
        if len(samples) < 10:
            return (0.0, 0.0, 0.0)

        try:
            low = np.sqrt(np.mean(lfilter(self.b_low, self.a_low, samples) ** 2))
            mid = np.sqrt(np.mean(lfilter(self.b_mid, self.a_mid, samples) ** 2))
            high = np.sqrt(np.mean(lfilter(self.b_high, self.a_high, samples) ** 2))
            return (float(low), float(mid), float(high))
        except Exception:
            return (0.0, 0.0, 0.0)

    def _energy_to_viseme(
        self, energy: float, bands: tuple, is_silent: bool
    ) -> int:
        """
        Map audio energy and frequency bands to a viseme index (0-11).

        12-viseme system:
          0: Neutral (rest/silence)
          1: Aa (wide open)
          2: D (tongue ridge)
          3: Ee (wide smile)
          4: F (lip under teeth)
          5: L (tongue up)
          6: M (lips pressed)
          7: Oh (rounded open)
          8: R (slight pucker)
          9: S (teeth narrow)
         10: Uh (slightly open)
         11: W-Oo (pursed/rounded)
        """
        if is_silent:
            return 0  # Neutral

        low, mid, high = bands

        # Fricatives/sibilants detected by high frequency energy
        if high > 0.05 and high > low * 1.5:
            if energy > 0.15:
                return 9  # S - teeth narrow (strong fricative)
            return 4  # F - lip under teeth (soft fricative)

        # Nasals/stops: mid-heavy with low energy
        if energy < 0.1 and mid > low:
            return 6  # M - lips pressed

        # Main energy-based mapping
        if energy > 0.6:
            return 1  # Aa - wide open (loud)
        elif energy > 0.4:
            # Discriminate by frequency content
            if low > mid:
                return 7  # Oh - rounded open (low-dominant)
            return 1  # Aa - wide open
        elif energy > 0.25:
            if low > mid * 1.2:
                return 7  # Oh
            elif high > mid:
                return 3  # Ee - wide smile
            return 10  # Uh - slightly open
        elif energy > 0.15:
            if high > low:
                return 3  # Ee
            elif low > mid:
                return 11  # W-Oo - pursed
            return 10  # Uh
        elif energy > 0.08:
            if mid > low:
                return 2  # D - tongue ridge
            return 8  # R - slight pucker
        else:
            return 6  # M - lips pressed (trailing off)

    def reset(self):
        """Reset all internal state."""
        self.smoothed_energy = 0.0
        self.prev_energy = 0.0
        self.rising = False
        self.silence_frames = 0
