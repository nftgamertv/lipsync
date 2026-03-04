"""
Text-to-viseme processor.

Converts text input into a sequence of viseme indices with estimated durations.
Uses rule-based phoneme approximation (digraphs, vowels, consonants).

12-viseme system:
  0: Neutral   1: Aa   2: D    3: Ee   4: F    5: L
  6: M         7: Oh   8: R    9: S   10: Uh  11: W-Oo
"""

from typing import List, Dict


class VisemeEvent:
    __slots__ = ("viseme", "duration", "char_source")

    def __init__(self, viseme: int, duration: float, char_source: str = ""):
        self.viseme = viseme
        self.duration = duration
        self.char_source = char_source

    def to_dict(self) -> dict:
        return {
            "viseme": self.viseme,
            "duration": self.duration,
            "char_source": self.char_source,
        }


# Digraph mappings (checked before single chars)
DIGRAPH_MAP: Dict[str, int] = {
    "th": 2,   # D (tongue ridge, th-sound)
    "sh": 9,   # S (teeth narrow)
    "ch": 9,   # S
    "zh": 9,   # S
    "ph": 4,   # F
    "wh": 11,  # W-Oo
    "oo": 11,  # W-Oo
    "ee": 3,   # Ee
    "ea": 3,   # Ee
    "ai": 1,   # Aa
    "ay": 1,   # Aa
    "oa": 7,   # Oh
    "ou": 7,   # Oh
    "ow": 7,   # Oh
    "oi": 7,   # Oh
    "au": 1,   # Aa
}

# Single character mappings
CHAR_MAP: Dict[str, int] = {
    # Vowels
    "a": 1,   # Aa
    "e": 3,   # Ee
    "i": 3,   # Ee
    "o": 7,   # Oh
    "u": 10,  # Uh
    # Bilabials (lips pressed)
    "p": 6,   # M
    "b": 6,   # M
    "m": 6,   # M
    # Labiodentals (lip under teeth)
    "f": 4,   # F
    "v": 4,   # F
    # Sibilants (teeth narrow)
    "s": 9,   # S
    "z": 9,   # S
    "j": 9,   # S
    # Alveolars (tongue on ridge)
    "t": 2,   # D
    "d": 2,   # D
    "n": 2,   # D
    # Lateral/Rhotic
    "l": 5,   # L
    "r": 8,   # R
    # Velars (mapped to tongue ridge)
    "k": 2,   # D
    "g": 2,   # D
    "c": 9,   # S (soft c default)
    # Glides
    "w": 11,  # W-Oo
    "y": 3,   # Ee
    # Others
    "h": 10,  # Uh (breathy)
    "q": 6,   # M
    "x": 9,   # S
}

# Duration constants (milliseconds)
BASE_DURATION = 100.0
MIN_DURATION = 50.0
MAX_DURATION = 200.0
REST_DURATION = 80.0
VOWEL_MULTIPLIER = 1.3
CONSONANT_MULTIPLIER = 0.8


class TextProcessor:
    def __init__(self):
        self.viseme_count = 12
        self.speed_multiplier = 1.0

    def process_text(self, text: str) -> List[dict]:
        """
        Convert text to a sequence of viseme events with durations.

        Args:
            text: Input text string

        Returns:
            List of viseme event dicts with viseme index, duration, and source char
        """
        if not text or not text.strip():
            return []

        text = text.lower().strip()
        events: List[VisemeEvent] = []
        i = 0

        while i < len(text):
            ch = text[i]

            # Whitespace -> rest viseme
            if ch == " ":
                # Merge consecutive spaces
                if not events or events[-1].viseme != 0:
                    events.append(VisemeEvent(0, REST_DURATION, " "))
                i += 1
                continue

            # Skip non-alpha
            if not ch.isalpha():
                i += 1
                continue

            # Check digraphs first
            if i + 1 < len(text):
                digraph = text[i : i + 2]
                if digraph in DIGRAPH_MAP:
                    viseme = DIGRAPH_MAP[digraph]
                    dur = self._compute_duration(digraph, is_vowel=self._is_vowel_digraph(digraph))
                    events.append(VisemeEvent(viseme, dur, digraph))
                    i += 2
                    continue

            # Single character
            if ch in CHAR_MAP:
                viseme = CHAR_MAP[ch]
                dur = self._compute_duration(ch, is_vowel=ch in "aeiou")
                events.append(VisemeEvent(viseme, dur, ch))
            # Unknown char -> skip
            i += 1

        return [e.to_dict() for e in events]

    def _compute_duration(self, chars: str, is_vowel: bool) -> float:
        """Compute duration for a phoneme unit."""
        base = BASE_DURATION
        if is_vowel:
            base *= VOWEL_MULTIPLIER
        else:
            base *= CONSONANT_MULTIPLIER

        base /= self.speed_multiplier
        return max(MIN_DURATION, min(MAX_DURATION, base))

    def _is_vowel_digraph(self, digraph: str) -> bool:
        """Check if a digraph represents a vowel sound."""
        vowel_digraphs = {"oo", "ee", "ea", "ai", "ay", "oa", "ou", "ow", "oi", "au"}
        return digraph in vowel_digraphs

    def set_speed(self, multiplier: float):
        """Set speed multiplier (0.5 = half speed, 2.0 = double speed)."""
        self.speed_multiplier = max(0.25, min(4.0, multiplier))
