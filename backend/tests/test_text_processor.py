"""Tests for TextProcessor - text-to-viseme conversion."""

import pytest
from text_processor import TextProcessor, CHAR_MAP, DIGRAPH_MAP


class TestBasicMapping:
    def test_empty_string_returns_empty(self):
        tp = TextProcessor()
        assert tp.process_text("") == []

    def test_whitespace_only_returns_empty(self):
        tp = TextProcessor()
        assert tp.process_text("   ") == []

    def test_single_vowel_a(self):
        tp = TextProcessor()
        events = tp.process_text("a")
        assert len(events) == 1
        assert events[0]["viseme"] == 1  # Aa

    def test_single_vowel_e(self):
        tp = TextProcessor()
        events = tp.process_text("e")
        assert len(events) == 1
        assert events[0]["viseme"] == 3  # Ee

    def test_single_vowel_o(self):
        tp = TextProcessor()
        events = tp.process_text("o")
        assert len(events) == 1
        assert events[0]["viseme"] == 7  # Oh

    def test_single_vowel_u(self):
        tp = TextProcessor()
        events = tp.process_text("u")
        assert len(events) == 1
        assert events[0]["viseme"] == 10  # Uh

    def test_consonant_m(self):
        tp = TextProcessor()
        events = tp.process_text("m")
        assert len(events) == 1
        assert events[0]["viseme"] == 6  # M (lips pressed)

    def test_consonant_f(self):
        tp = TextProcessor()
        events = tp.process_text("f")
        assert len(events) == 1
        assert events[0]["viseme"] == 4  # F (lip under teeth)

    def test_consonant_s(self):
        tp = TextProcessor()
        events = tp.process_text("s")
        assert len(events) == 1
        assert events[0]["viseme"] == 9  # S (teeth narrow)

    def test_consonant_l(self):
        tp = TextProcessor()
        events = tp.process_text("l")
        assert len(events) == 1
        assert events[0]["viseme"] == 5  # L (tongue up)

    def test_consonant_r(self):
        tp = TextProcessor()
        events = tp.process_text("r")
        assert len(events) == 1
        assert events[0]["viseme"] == 8  # R (pucker)


class TestDigraphs:
    def test_th(self):
        tp = TextProcessor()
        events = tp.process_text("th")
        assert len(events) == 1
        assert events[0]["viseme"] == 2  # D (tongue ridge)

    def test_sh(self):
        tp = TextProcessor()
        events = tp.process_text("sh")
        assert len(events) == 1
        assert events[0]["viseme"] == 9  # S

    def test_ch(self):
        tp = TextProcessor()
        events = tp.process_text("ch")
        assert len(events) == 1
        assert events[0]["viseme"] == 9  # S

    def test_oo(self):
        tp = TextProcessor()
        events = tp.process_text("oo")
        assert len(events) == 1
        assert events[0]["viseme"] == 11  # W-Oo

    def test_ee(self):
        tp = TextProcessor()
        events = tp.process_text("ee")
        assert len(events) == 1
        assert events[0]["viseme"] == 3  # Ee

    def test_digraph_takes_priority_over_singles(self):
        """'th' should produce 1 event, not 2 (t + h)."""
        tp = TextProcessor()
        events = tp.process_text("th")
        assert len(events) == 1

    def test_all_digraphs_produce_valid_visemes(self):
        tp = TextProcessor()
        for digraph, expected in DIGRAPH_MAP.items():
            events = tp.process_text(digraph)
            assert len(events) == 1, f"Digraph '{digraph}' produced {len(events)} events"
            assert events[0]["viseme"] == expected, f"Digraph '{digraph}' mapped to {events[0]['viseme']}, expected {expected}"


class TestWords:
    def test_word_hello(self):
        tp = TextProcessor()
        events = tp.process_text("hello")
        # h, e, l, l, o -> 5 visemes
        assert len(events) == 5
        visemes = [e["viseme"] for e in events]
        assert visemes[0] == 10  # h -> Uh
        assert visemes[1] == 3   # e -> Ee
        assert visemes[2] == 5   # l -> L
        assert visemes[3] == 5   # l -> L
        assert visemes[4] == 7   # o -> Oh

    def test_word_with_digraph(self):
        tp = TextProcessor()
        events = tp.process_text("the")
        # th -> D, e -> Ee
        assert len(events) == 2
        assert events[0]["viseme"] == 2   # th -> D
        assert events[1]["viseme"] == 3   # e -> Ee

    def test_space_inserts_rest(self):
        tp = TextProcessor()
        events = tp.process_text("a b")
        # a, rest, b
        assert len(events) == 3
        assert events[0]["viseme"] == 1   # a -> Aa
        assert events[1]["viseme"] == 0   # space -> Neutral (rest)
        assert events[2]["viseme"] == 6   # b -> M

    def test_multiple_spaces_produce_single_rest(self):
        tp = TextProcessor()
        events = tp.process_text("a   b")
        # a, rest (merged), b
        assert len(events) == 3

    def test_punctuation_skipped(self):
        tp = TextProcessor()
        events = tp.process_text("hi!")
        # h, i
        assert len(events) == 2

    def test_case_insensitive(self):
        tp = TextProcessor()
        upper = tp.process_text("HELLO")
        lower = tp.process_text("hello")
        assert len(upper) == len(lower)
        for u, l in zip(upper, lower):
            assert u["viseme"] == l["viseme"]


class TestDurations:
    def test_all_events_have_positive_duration(self):
        tp = TextProcessor()
        events = tp.process_text("the quick brown fox jumps")
        for event in events:
            assert event["duration"] > 0

    def test_vowels_longer_than_consonants(self):
        tp = TextProcessor()
        vowel_events = tp.process_text("a")
        consonant_events = tp.process_text("t")
        assert vowel_events[0]["duration"] > consonant_events[0]["duration"]

    def test_speed_multiplier(self):
        tp = TextProcessor()
        normal = tp.process_text("hello")
        tp.set_speed(2.0)
        fast = tp.process_text("hello")

        for n, f in zip(normal, fast):
            assert f["duration"] < n["duration"]

    def test_speed_clamped(self):
        tp = TextProcessor()
        tp.set_speed(100)  # Way too high
        assert tp.speed_multiplier == 4.0
        tp.set_speed(0.001)  # Way too low
        assert tp.speed_multiplier == 0.25


class TestCharSourceTracking:
    def test_events_include_char_source(self):
        tp = TextProcessor()
        events = tp.process_text("ab")
        assert events[0]["char_source"] == "a"
        assert events[1]["char_source"] == "b"

    def test_digraph_source_is_two_chars(self):
        tp = TextProcessor()
        events = tp.process_text("th")
        assert events[0]["char_source"] == "th"


class TestAllCharsMapped:
    def test_every_letter_in_charmap(self):
        """Every letter a-z should have a mapping."""
        for ch in "abcdefghijklmnopqrstuvwxyz":
            assert ch in CHAR_MAP, f"Letter '{ch}' missing from CHAR_MAP"

    def test_all_charmap_values_valid(self):
        for ch, viseme in CHAR_MAP.items():
            assert 0 <= viseme <= 11, f"CHAR_MAP['{ch}'] = {viseme} is out of range"

    def test_all_digraph_values_valid(self):
        for dg, viseme in DIGRAPH_MAP.items():
            assert 0 <= viseme <= 11, f"DIGRAPH_MAP['{dg}'] = {viseme} is out of range"
