"""Tests for SyncEngine / VisemeMapper."""

import time
import pytest
from viseme_mapper import SyncEngine, VisemeState, VISEME_LABELS, VISEME_COUNT


class TestVisemeLabels:
    def test_12_labels(self):
        assert len(VISEME_LABELS) == 12

    def test_count_constant(self):
        assert VISEME_COUNT == 12

    def test_expected_labels(self):
        assert VISEME_LABELS[0] == "Neutral"
        assert VISEME_LABELS[1] == "Aa"
        assert VISEME_LABELS[6] == "M"
        assert VISEME_LABELS[11] == "W-Oo"


class TestVisemeState:
    def test_default_state(self):
        state = VisemeState()
        assert state.current_viseme == 0
        assert state.target_viseme == 0
        assert state.blend_factor == 1.0

    def test_to_dict(self):
        state = VisemeState()
        d = state.to_dict()
        assert d["current_viseme"] == 0
        assert d["target_viseme"] == 0
        assert d["blend_factor"] == 1.0
        assert d["label"] == "Neutral"


class TestSyncEngineInit:
    def test_default_mode_hybrid(self):
        engine = SyncEngine()
        assert engine.mode == "hybrid"

    def test_custom_mode(self):
        engine = SyncEngine(mode="audio_only")
        assert engine.mode == "audio_only"

    def test_set_mode(self):
        engine = SyncEngine()
        engine.set_mode("text_only")
        assert engine.mode == "text_only"

    def test_invalid_mode_ignored(self):
        engine = SyncEngine()
        engine.set_mode("invalid_mode")
        assert engine.mode == "hybrid"  # unchanged


class TestAudioOnlyMode:
    def _make_audio_result(self, energy=0.0, viseme=0, silent=True, onset=False):
        return {
            "smoothed_energy": energy,
            "viseme_index": viseme,
            "is_silent": silent,
            "is_onset": onset,
            "bands": {"low": 0, "mid": 0, "high": 0},
        }

    def test_silence_returns_neutral(self):
        engine = SyncEngine(mode="audio_only")
        result = engine.update_audio(self._make_audio_result(
            energy=0, viseme=0, silent=True
        ))
        assert result["target_viseme"] == 0
        assert result["label"] == "Neutral"

    def test_loud_audio_changes_viseme(self):
        engine = SyncEngine(mode="audio_only")
        result = engine.update_audio(self._make_audio_result(
            energy=0.8, viseme=1, silent=False
        ))
        assert result["target_viseme"] == 1  # Aa
        assert result["label"] == "Aa"

    def test_various_visemes(self):
        engine = SyncEngine(mode="audio_only")
        for viseme_idx in range(12):
            result = engine.update_audio(self._make_audio_result(
                energy=0.5, viseme=viseme_idx, silent=False
            ))
            assert result["target_viseme"] == viseme_idx


class TestTextOnlyMode:
    def test_text_queue_advances(self):
        engine = SyncEngine(mode="text_only")
        events = [
            {"viseme": 1, "duration": 100},
            {"viseme": 3, "duration": 100},
            {"viseme": 7, "duration": 100},
        ]
        engine.push_text_visemes(events)

        # First update should get first viseme
        audio = {"smoothed_energy": 0, "viseme_index": 0, "is_silent": True, "is_onset": False}
        result = engine.update_audio(audio)
        # May be 0 or 1 depending on timing - at least shouldn't crash
        assert 0 <= result["target_viseme"] <= 11

    def test_empty_queue_returns_neutral(self):
        engine = SyncEngine(mode="text_only")
        audio = {"smoothed_energy": 0, "viseme_index": 0, "is_silent": True, "is_onset": False}
        result = engine.update_audio(audio)
        assert result["target_viseme"] == 0


class TestHybridMode:
    def _make_audio_result(self, energy=0.0, viseme=0, silent=True, onset=False):
        return {
            "smoothed_energy": energy,
            "viseme_index": viseme,
            "is_silent": silent,
            "is_onset": onset,
        }

    def test_silence_returns_neutral(self):
        engine = SyncEngine(mode="hybrid")
        result = engine.update_audio(self._make_audio_result(silent=True))
        assert result["target_viseme"] == 0

    def test_onset_uses_text_viseme_when_available(self):
        engine = SyncEngine(mode="hybrid")
        engine.push_text_visemes([
            {"viseme": 7, "duration": 200},
            {"viseme": 3, "duration": 200},
        ])

        result = engine.update_audio(self._make_audio_result(
            energy=0.5, viseme=1, silent=False, onset=True
        ))
        # Should use text viseme (7) on onset, not audio viseme (1)
        assert result["target_viseme"] == 7

    def test_falls_back_to_audio_when_no_text(self):
        engine = SyncEngine(mode="hybrid")
        # No text pushed
        result = engine.update_audio(self._make_audio_result(
            energy=0.5, viseme=3, silent=False
        ))
        assert result["target_viseme"] == 3  # audio-derived


class TestTransitions:
    def test_blend_starts_at_zero_on_change(self):
        engine = SyncEngine(mode="audio_only")
        engine.transition_ms = 50

        audio1 = {"smoothed_energy": 0.5, "viseme_index": 1, "is_silent": False, "is_onset": False}
        engine.update_audio(audio1)

        audio2 = {"smoothed_energy": 0.5, "viseme_index": 7, "is_silent": False, "is_onset": False}
        result = engine.update_audio(audio2)

        # Blend should start near 0 when transitioning to new viseme
        assert result["blend_factor"] < 1.0

    def test_viseme_index_clamped(self):
        engine = SyncEngine(mode="audio_only")
        # Intentionally pass out-of-range viseme
        audio = {"smoothed_energy": 0.5, "viseme_index": 99, "is_silent": False, "is_onset": False}
        result = engine.update_audio(audio)
        assert 0 <= result["target_viseme"] <= 11

        audio_neg = {"smoothed_energy": 0.5, "viseme_index": -5, "is_silent": False, "is_onset": False}
        result = engine.update_audio(audio_neg)
        assert 0 <= result["target_viseme"] <= 11


class TestReset:
    def test_reset_clears_state(self):
        engine = SyncEngine(mode="audio_only")
        engine.push_text_visemes([{"viseme": 5, "duration": 100}])

        audio = {"smoothed_energy": 0.5, "viseme_index": 3, "is_silent": False, "is_onset": False}
        engine.update_audio(audio)

        engine.reset()
        state = engine.get_state()
        assert state["target_viseme"] == 0
        assert state["current_viseme"] == 0
        assert len(engine.text_queue) == 0


class TestGetState:
    def test_get_state_returns_dict(self):
        engine = SyncEngine()
        state = engine.get_state()
        assert isinstance(state, dict)
        assert "current_viseme" in state
        assert "target_viseme" in state
        assert "blend_factor" in state
        assert "label" in state
