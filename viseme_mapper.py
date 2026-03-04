"""
Viseme mapping and synchronization engine.

Combines audio analysis results with text-derived viseme sequences
to produce final viseme output with smooth transitions.

Supports three modes:
  - hybrid: Audio timing + text viseme selection
  - audio_only: Pure energy/frequency-based viseme mapping
  - text_only: Text-derived viseme sequence on timer
"""

import time
from typing import List, Optional, Dict


# Viseme labels for the 12-shape system
VISEME_LABELS = [
    "Neutral",  # 0
    "Aa",       # 1
    "D",        # 2
    "Ee",       # 3
    "F",        # 4
    "L",        # 5
    "M",        # 6
    "Oh",       # 7
    "R",        # 8
    "S",        # 9
    "Uh",       # 10
    "W-Oo",     # 11
]

VISEME_COUNT = 12


class VisemeState:
    """Current viseme output state with blending info."""

    def __init__(self):
        self.current_viseme = 0
        self.target_viseme = 0
        self.blend_factor = 1.0  # 0.0 = current, 1.0 = target (fully transitioned)
        self.transition_start = 0.0
        self.transition_duration = 0.05  # 50ms default lerp

    def to_dict(self) -> dict:
        return {
            "current_viseme": self.current_viseme,
            "target_viseme": self.target_viseme,
            "blend_factor": self.blend_factor,
            "label": VISEME_LABELS[self.target_viseme],
        }


class SyncEngine:
    def __init__(self, mode: str = "hybrid"):
        self.mode = mode
        self.state = VisemeState()

        # Text viseme queue
        self.text_queue: List[dict] = []
        self.queue_index = 0
        self.queue_start_time = 0.0
        self.queue_elapsed = 0.0

        # Timing
        self.last_update = time.time()
        self.transition_ms = 120.0  # ms for lerp between visemes
        self.min_hold_ms = 80.0  # minimum time a viseme stays before switching
        self.last_transition_time = 0.0  # when we last changed target viseme

        # Audio state
        self.last_audio_viseme = 0
        self.last_audio_energy = 0.0

    def set_mode(self, mode: str):
        """Set sync mode: hybrid, audio_only, text_only."""
        if mode in ("hybrid", "audio_only", "text_only"):
            self.mode = mode

    def push_text_visemes(self, viseme_events: List[dict]):
        """Load a new text viseme sequence into the queue."""
        self.text_queue = viseme_events
        self.queue_index = 0
        self.queue_start_time = time.time()
        self.queue_elapsed = 0.0

    def update_audio(self, audio_result: dict) -> dict:
        """
        Process an audio analysis frame and return the current viseme state.

        Args:
            audio_result: Output from AudioProcessor.process_chunk()

        Returns:
            dict with current viseme state
        """
        now = time.time()
        dt = now - self.last_update
        self.last_update = now

        self.last_audio_energy = audio_result.get("smoothed_energy", 0.0)
        audio_viseme = audio_result.get("viseme_index", 0)
        is_silent = audio_result.get("is_silent", True)
        is_onset = audio_result.get("is_onset", False)

        if self.mode == "audio_only":
            target = audio_viseme if not is_silent else 0
            self._transition_to(target, now)

        elif self.mode == "text_only":
            target = self._advance_text_queue(dt)
            self._transition_to(target, now)

        elif self.mode == "hybrid":
            text_viseme = self._peek_text_queue()

            if is_silent:
                target = 0
            elif is_onset and text_viseme is not None:
                # On syllable onset, use text-derived viseme
                self._advance_text_queue(dt)
                target = text_viseme
            elif text_viseme is not None and self.last_audio_energy > 0.05:
                # Speaking but no onset - use text viseme if audio is active
                target = text_viseme
                self._advance_text_queue(dt)
            else:
                # Fall back to audio-derived viseme
                target = audio_viseme

            self._transition_to(target, now)

        # Update blend
        self._update_blend(now)

        return self.state.to_dict()

    def get_state(self) -> dict:
        """Get current viseme state without updating."""
        return self.state.to_dict()

    def _transition_to(self, target: int, now: float):
        """Start a transition to a new target viseme, respecting minimum hold time."""
        target = max(0, min(VISEME_COUNT - 1, target))
        if target != self.state.target_viseme:
            # Always allow returning to Neutral (silence); hold time only
            # applies to switching between active mouth shapes
            if target != 0:
                elapsed_since_last = (now - self.last_transition_time) * 1000
                if elapsed_since_last < self.min_hold_ms:
                    return
            self.state.current_viseme = self.state.target_viseme
            self.state.target_viseme = target
            self.state.blend_factor = 0.0
            self.state.transition_start = now
            self.last_transition_time = now

    def _update_blend(self, now: float):
        """Update the blend factor for smooth transitions."""
        if self.state.blend_factor >= 1.0:
            return

        elapsed = (now - self.state.transition_start) * 1000  # ms
        self.state.blend_factor = min(1.0, elapsed / self.transition_ms)

    def _peek_text_queue(self) -> Optional[int]:
        """Look at the next text viseme without advancing."""
        if self.queue_index < len(self.text_queue):
            return self.text_queue[self.queue_index].get("viseme", 0)
        return None

    def _advance_text_queue(self, dt: float) -> int:
        """Advance through text queue based on elapsed time, return current viseme."""
        if not self.text_queue or self.queue_index >= len(self.text_queue):
            return 0

        self.queue_elapsed += dt * 1000  # convert to ms

        # Sum durations up to current index to find where we are
        accumulated = 0.0
        for i, event in enumerate(self.text_queue):
            accumulated += event.get("duration", 100)
            if self.queue_elapsed < accumulated:
                self.queue_index = i
                return event.get("viseme", 0)

        # Past end of queue
        self.queue_index = len(self.text_queue)
        return 0

    def reset(self):
        """Reset all state."""
        self.state = VisemeState()
        self.text_queue = []
        self.queue_index = 0
        self.queue_elapsed = 0.0
        self.last_audio_viseme = 0
        self.last_audio_energy = 0.0
        self.last_transition_time = 0.0
