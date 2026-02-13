"""Tests for AudioProcessor - real audio signal analysis."""

import numpy as np
import pytest
from audio_processor import AudioProcessor


class TestAudioDecoding:
    def test_decode_float32(self):
        processor = AudioProcessor(sample_rate=44100, chunk_size=512)
        # Generate a known sine wave
        t = np.linspace(0, 0.01, 512, dtype=np.float32)
        samples = np.sin(2 * np.pi * 440 * t).astype(np.float32)
        audio_bytes = samples.tobytes()

        result = processor.process_chunk(audio_bytes, format="float32")
        assert result["rms"] > 0
        assert result["peak"] > 0

    def test_decode_int16(self):
        processor = AudioProcessor(sample_rate=44100, chunk_size=512)
        # Generate int16 audio data
        t = np.linspace(0, 0.01, 512)
        samples = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
        audio_bytes = samples.tobytes()

        result = processor.process_chunk(audio_bytes, format="int16")
        assert result["rms"] > 0.3  # ~0.49 RMS for this signal
        assert result["peak"] > 0.4

    def test_invalid_format_returns_silent(self):
        processor = AudioProcessor()
        result = processor.process_chunk(b"junk", format="invalid")
        assert result["is_silent"] is True
        assert result["viseme_index"] == 0

    def test_empty_data_returns_silent(self):
        processor = AudioProcessor()
        result = processor.process_chunk(b"", format="float32")
        assert result["is_silent"] is True
        assert result["viseme_index"] == 0


class TestRMSComputation:
    def test_silence_has_zero_rms(self):
        processor = AudioProcessor(chunk_size=512)
        silence = np.zeros(512, dtype=np.float32).tobytes()
        result = processor.process_chunk(silence)
        assert result["rms"] == 0.0

    def test_full_scale_sine_rms(self):
        """A full-scale sine wave should have RMS ≈ 0.707."""
        processor = AudioProcessor(sample_rate=44100, chunk_size=4096)
        t = np.linspace(0, 4096 / 44100, 4096, dtype=np.float32)
        samples = np.sin(2 * np.pi * 440 * t).astype(np.float32)
        result = processor.process_chunk(samples.tobytes())
        assert 0.65 < result["rms"] < 0.75  # ≈ 1/√2

    def test_louder_signal_higher_rms(self):
        processor = AudioProcessor(chunk_size=1024)
        t = np.linspace(0, 0.02, 1024, dtype=np.float32)

        quiet = (np.sin(2 * np.pi * 440 * t) * 0.1).astype(np.float32)
        loud = (np.sin(2 * np.pi * 440 * t) * 0.9).astype(np.float32)

        r_quiet = processor.process_chunk(quiet.tobytes())
        processor.reset()
        r_loud = processor.process_chunk(loud.tobytes())

        assert r_loud["rms"] > r_quiet["rms"] * 5


class TestSmoothing:
    def test_smoothing_decays_after_silence(self):
        processor = AudioProcessor(chunk_size=512)

        # Send loud chunk
        loud = (np.ones(512, dtype=np.float32) * 0.5)
        processor.process_chunk(loud.tobytes())
        energy_after_loud = processor.smoothed_energy

        # Send silent chunk
        silence = np.zeros(512, dtype=np.float32)
        processor.process_chunk(silence.tobytes())
        energy_after_silence = processor.smoothed_energy

        # Energy should have decayed but not instantly to zero
        assert energy_after_silence < energy_after_loud
        assert energy_after_silence > 0

    def test_ema_alpha_applied(self):
        """Verify EMA smoothing: new = alpha * current + (1-alpha) * old"""
        processor = AudioProcessor(chunk_size=512)
        processor.alpha = 0.5

        signal = np.ones(512, dtype=np.float32) * 0.8
        processor.process_chunk(signal.tobytes())
        first_energy = processor.smoothed_energy

        silence = np.zeros(512, dtype=np.float32)
        processor.process_chunk(silence.tobytes())
        # Should be 0.5 * 0.0 + 0.5 * first_energy
        assert abs(processor.smoothed_energy - first_energy * 0.5) < 0.01


class TestPeakDetection:
    def test_onset_detected_on_sudden_increase(self):
        processor = AudioProcessor(chunk_size=512)
        processor.peak_threshold = 0.05

        # Start with silence
        silence = np.zeros(512, dtype=np.float32)
        processor.process_chunk(silence.tobytes())

        # Sudden loud signal should trigger onset
        loud = (np.ones(512, dtype=np.float32) * 0.5)
        result = processor.process_chunk(loud.tobytes())
        assert result["is_onset"] is True

    def test_no_onset_during_sustained_signal(self):
        processor = AudioProcessor(chunk_size=512)

        loud = (np.ones(512, dtype=np.float32) * 0.5)
        # First chunk triggers onset
        processor.process_chunk(loud.tobytes())
        # Second identical chunk should NOT trigger onset
        result = processor.process_chunk(loud.tobytes())
        assert result["is_onset"] is False


class TestFrequencyBands:
    def test_low_frequency_detected(self):
        """A 500 Hz tone should show up in the low band."""
        processor = AudioProcessor(sample_rate=44100, chunk_size=4096)
        t = np.linspace(0, 4096 / 44100, 4096, dtype=np.float32)
        samples = np.sin(2 * np.pi * 500 * t).astype(np.float32)
        result = processor.process_chunk(samples.tobytes())
        assert result["bands"]["low"] > result["bands"]["high"]

    def test_high_frequency_detected(self):
        """A 5000 Hz tone should show up in the high band."""
        processor = AudioProcessor(sample_rate=44100, chunk_size=4096)
        t = np.linspace(0, 4096 / 44100, 4096, dtype=np.float32)
        samples = np.sin(2 * np.pi * 5000 * t).astype(np.float32)
        result = processor.process_chunk(samples.tobytes())
        assert result["bands"]["high"] > result["bands"]["low"]


class TestVisemeMapping:
    def test_silence_maps_to_neutral(self):
        processor = AudioProcessor(chunk_size=512)
        # Many frames of silence to hit silence timeout
        silence = np.zeros(512, dtype=np.float32).tobytes()
        result = None
        for _ in range(50):
            result = processor.process_chunk(silence)
        assert result["viseme_index"] == 0  # Neutral

    def test_loud_signal_maps_to_non_neutral(self):
        processor = AudioProcessor(sample_rate=44100, chunk_size=1024)
        # Loud low-frequency sine (vowel-like)
        t = np.linspace(0, 1024 / 44100, 1024, dtype=np.float32)
        loud = (np.sin(2 * np.pi * 400 * t) * 0.9).astype(np.float32)
        # Feed multiple chunks to build up smoothed energy
        for _ in range(10):
            result = processor.process_chunk(loud.tobytes())

        # Should not be Neutral (0) for loud signal
        assert result["viseme_index"] != 0
        assert result["smoothed_energy"] > 0.3

    def test_all_viseme_indices_in_valid_range(self):
        processor = AudioProcessor(chunk_size=512)
        np.random.seed(123)
        for _ in range(100):
            signal = (np.random.randn(512).astype(np.float32) * np.random.rand())
            result = processor.process_chunk(signal.tobytes())
            assert 0 <= result["viseme_index"] <= 11

    def test_result_contains_all_fields(self):
        processor = AudioProcessor(chunk_size=512)
        samples = np.zeros(512, dtype=np.float32).tobytes()
        result = processor.process_chunk(samples)

        assert "rms" in result
        assert "peak" in result
        assert "smoothed_energy" in result
        assert "is_onset" in result
        assert "bands" in result
        assert "is_silent" in result
        assert "viseme_index" in result
        assert "confidence" in result
        assert "low" in result["bands"]
        assert "mid" in result["bands"]
        assert "high" in result["bands"]


class TestReset:
    def test_reset_clears_state(self):
        processor = AudioProcessor(chunk_size=512)
        loud = (np.ones(512, dtype=np.float32) * 0.5)
        processor.process_chunk(loud.tobytes())

        assert processor.smoothed_energy > 0

        processor.reset()
        assert processor.smoothed_energy == 0.0
        assert processor.prev_energy == 0.0
        assert processor.silence_frames == 0
