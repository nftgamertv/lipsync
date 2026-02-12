/**
 * TextProcessor - Converts text input to viseme sequences.
 * Uses rule-based phoneme approximation (no dictionary needed).
 *
 * Viseme Set (9 shapes):
 * 0: X  - Rest/Neutral (silence, pauses)
 * 1: A  - Open wide (AA, AE, AH) - "cat"
 * 2: B  - Rounded (AO, OW) - "boat"
 * 3: C  - Wide smile (IY, IH) - "see"
 * 4: D  - Pursed (UW, UH) - "you"
 * 5: E  - Consonant closure (P, B, M) - "map"
 * 6: F  - Lower lip in (F, V) - "fish"
 * 7: G  - Tongue out (TH, DH) - "the"
 * 8: H  - Teeth/lip (S, Z, CH, JH, SH, ZH) - "see"
 */
class TextProcessor {
  constructor() {
    this.visemeQueue = [];
    this.defaultDuration = 100; // ms per phoneme
    this.minDuration = 80;
    this.maxDuration = 150;

    // Digraph mappings (checked first)
    this.digraphMap = {
      'th': 7,
      'sh': 8,
      'ch': 8,
      'zh': 8,
      'ph': 6,
      'wh': 4,
      'oo': 4,
      'ee': 3,
      'ea': 3,
      'ai': 1,
      'ay': 1,
      'oa': 2,
      'ou': 2,
      'ow': 2,
      'oi': 2,
      'au': 2
    };

    // Single character mappings
    this.charMap = {
      'a': 1, 'e': 3, 'i': 3, 'o': 2, 'u': 4,
      'p': 5, 'b': 5, 'm': 5,
      'f': 6, 'v': 6,
      's': 8, 'z': 8, 'j': 8,
      't': 8, 'd': 8, 'n': 8,
      'l': 8, 'r': 1,
      'k': 8, 'g': 8, 'c': 8,
      'w': 4, 'y': 3,
      'h': 1, 'q': 4, 'x': 8
    };
  }

  /**
   * Normalize text: lowercase, remove non-letter characters.
   * @param {string} text
   * @returns {string}
   */
  normalize(text) {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().replace(/[^a-z\s]/g, '');
  }

  /**
   * Map a single character or digraph to a viseme ID.
   * @param {string} chars - 1-2 characters
   * @returns {number} viseme ID (0-8)
   */
  mapToViseme(chars) {
    if (!chars || chars.length === 0) return 0;
    const lower = chars.toLowerCase();
    if (lower.length >= 2 && this.digraphMap[lower.substring(0, 2)] !== undefined) {
      return this.digraphMap[lower.substring(0, 2)];
    }
    return this.charMap[lower[0]] !== undefined ? this.charMap[lower[0]] : 0;
  }

  /**
   * Process a text string into a viseme sequence with durations.
   * @param {string} text - Input text
   * @param {number} [timestamp] - Timestamp when text was received
   * @returns {Array<{viseme: number, duration: number, timestamp: number}>}
   */
  processText(text, timestamp) {
    const ts = timestamp || (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const normalized = this.normalize(text);
    if (!normalized) return [];

    const sequence = [];
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    let currentTime = ts;

    for (const word of words) {
      let i = 0;
      while (i < word.length) {
        let viseme;
        let consumed = 1;

        // Check digraphs first
        if (i + 1 < word.length) {
          const digraph = word.substring(i, i + 2);
          if (this.digraphMap[digraph] !== undefined) {
            viseme = this.digraphMap[digraph];
            consumed = 2;
          }
        }

        if (viseme === undefined) {
          viseme = this.charMap[word[i]] !== undefined ? this.charMap[word[i]] : 0;
        }

        const duration = this._computeDuration(word, i);
        sequence.push({
          viseme: viseme,
          duration: duration,
          timestamp: currentTime
        });
        currentTime += duration;
        i += consumed;
      }

      // Add a brief rest between words
      sequence.push({
        viseme: 0,
        duration: 50,
        timestamp: currentTime
      });
      currentTime += 50;
    }

    return sequence;
  }

  /**
   * Compute duration for a phoneme based on position in word.
   * Vowels get slightly longer duration.
   */
  _computeDuration(word, index) {
    const char = word[index];
    const isVowel = 'aeiou'.includes(char);
    const base = isVowel ? 120 : 90;
    return Math.max(this.minDuration, Math.min(this.maxDuration, base));
  }

  /**
   * Add a text chunk to the viseme queue for incremental processing.
   * @param {string} text
   */
  addTextChunk(text) {
    const sequence = this.processText(text);
    this.visemeQueue.push(...sequence);
  }

  /**
   * Get the next viseme from the queue.
   * @returns {{viseme: number, duration: number, timestamp: number}|null}
   */
  getNextViseme() {
    if (this.visemeQueue.length === 0) return null;
    return this.visemeQueue.shift();
  }

  /**
   * Peek at the next viseme without removing it.
   */
  peekNextViseme() {
    if (this.visemeQueue.length === 0) return null;
    return this.visemeQueue[0];
  }

  /**
   * Get remaining queue length.
   */
  getQueueLength() {
    return this.visemeQueue.length;
  }

  /**
   * Clear the viseme queue.
   */
  clearQueue() {
    this.visemeQueue = [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextProcessor;
}
