/**
 * TextProcessor - Converts text input to viseme sequences.
 * Uses rule-based phoneme approximation (no dictionary needed).
 *
 * Viseme Set (12 shapes):
 *  0: Neutral - Rest/silence, mouth closed
 *  1: Aa      - Wide open "ah" (father, cat)
 *  2: D       - Tongue on ridge (d, t, n)
 *  3: Ee      - Wide smile (ee, ih — "see", "bit")
 *  4: F       - Lower lip under upper teeth (f, v)
 *  5: L       - Tongue tip up (l)
 *  6: M       - Lips pressed (m, b, p)
 *  7: Oh      - Rounded open (oh, aw — "boat", "saw")
 *  8: R       - Slight pucker/open (r)
 *  9: S       - Teeth together narrow (s, z, sh, ch)
 * 10: Uh      - Slightly open relaxed (uh, schwa)
 * 11: W-Oo    - Pursed/rounded (w, oo — "we", "blue")
 */
class TextProcessor {
  constructor() {
    this.visemeQueue = [];
    this.defaultDuration = 100; // ms per phoneme
    this.minDuration = 80;
    this.maxDuration = 150;
    this.visemeCount = 12; // Total number of viseme shapes (0-11)

    // Digraph mappings (checked first)
    this.digraphMap = {
      'th': 2,   // D — tongue on ridge
      'sh': 9,   // S — teeth narrow
      'ch': 9,   // S — teeth narrow
      'zh': 9,   // S — teeth narrow
      'ph': 4,   // F — lip under teeth
      'wh': 11,  // W-Oo — pursed
      'oo': 11,  // W-Oo — pursed rounded
      'ee': 3,   // Ee — wide smile
      'ea': 3,   // Ee — wide smile
      'ai': 1,   // Aa — wide open
      'ay': 1,   // Aa — wide open
      'oa': 7,   // Oh — rounded open
      'ou': 7,   // Oh — rounded open
      'ow': 7,   // Oh — rounded open
      'oi': 7,   // Oh — rounded open
      'au': 1    // Aa — wide open
    };

    // Single character mappings
    this.charMap = {
      'a': 1,  'e': 3,  'i': 3,  'o': 7,  'u': 10,
      'p': 6,  'b': 6,  'm': 6,
      'f': 4,  'v': 4,
      's': 9,  'z': 9,  'j': 9,
      't': 2,  'd': 2,  'n': 2,
      'l': 5,  'r': 8,
      'k': 2,  'g': 2,  'c': 9,
      'w': 11, 'y': 3,
      'h': 10, 'q': 6,  'x': 9
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
   * @returns {number} viseme ID (0-11)
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
