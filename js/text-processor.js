/**
 * TextProcessor - Converts text input to viseme sequences.
 * Uses rule-based phoneme approximation (no dictionary needed).
 *
 * Viseme Set (5 shapes):
 * 0: Rest     - Neutral/silence (simple closed line)
 * 1: Closed   - Closed consonants M, B, P (closed smile)
 * 2: Teeth    - Teeth sounds EE, S, Z, F, V, TH (teeth smile)
 * 3: Open     - Open vowels AH, OH, EH (open wavy mouth)
 * 4: Wide     - Wide open AA, loud emphasis (wide open + tongue)
 */
class TextProcessor {
  constructor() {
    this.visemeQueue = [];
    this.defaultDuration = 100; // ms per phoneme
    this.minDuration = 80;
    this.maxDuration = 150;
    this.visemeCount = 5; // Total number of viseme shapes (0-4)

    // Digraph mappings (checked first)
    this.digraphMap = {
      'th': 2,  // teeth
      'sh': 2,  // teeth
      'ch': 2,  // teeth
      'zh': 2,  // teeth
      'ph': 2,  // teeth (like F)
      'wh': 3,  // open
      'oo': 3,  // open rounded
      'ee': 2,  // teeth smile
      'ea': 3,  // open
      'ai': 4,  // wide open
      'ay': 4,  // wide open
      'oa': 3,  // open
      'ou': 3,  // open
      'ow': 3,  // open
      'oi': 3,  // open
      'au': 4   // wide open
    };

    // Single character mappings
    this.charMap = {
      'a': 4, 'e': 3, 'i': 2, 'o': 3, 'u': 3,
      'p': 1, 'b': 1, 'm': 1,
      'f': 2, 'v': 2,
      's': 2, 'z': 2, 'j': 2,
      't': 2, 'd': 2, 'n': 2,
      'l': 2, 'r': 3,
      'k': 2, 'g': 2, 'c': 2,
      'w': 3, 'y': 2,
      'h': 3, 'q': 1, 'x': 2
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
   * @returns {number} viseme ID (0-4)
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
