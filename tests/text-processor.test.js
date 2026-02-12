/**
 * Tests for TextProcessor module.
 */
const TextProcessor = require('../js/text-processor');

describe('TextProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new TextProcessor();
  });

  describe('constructor', () => {
    test('initializes with default values', () => {
      expect(processor.visemeQueue).toEqual([]);
      expect(processor.defaultDuration).toBe(100);
      expect(processor.minDuration).toBe(80);
      expect(processor.maxDuration).toBe(150);
    });

    test('has digraph map with expected entries', () => {
      expect(processor.digraphMap['th']).toBe(7);
      expect(processor.digraphMap['sh']).toBe(8);
      expect(processor.digraphMap['ch']).toBe(8);
      expect(processor.digraphMap['ee']).toBe(3);
      expect(processor.digraphMap['oo']).toBe(4);
    });

    test('has char map with expected entries', () => {
      expect(processor.charMap['a']).toBe(1);
      expect(processor.charMap['e']).toBe(3);
      expect(processor.charMap['o']).toBe(2);
      expect(processor.charMap['p']).toBe(5);
      expect(processor.charMap['f']).toBe(6);
      expect(processor.charMap['s']).toBe(8);
    });
  });

  describe('normalize', () => {
    test('converts to lowercase', () => {
      expect(processor.normalize('Hello')).toBe('hello');
    });

    test('removes punctuation', () => {
      expect(processor.normalize('Hello, World!')).toBe('hello world');
    });

    test('removes numbers', () => {
      expect(processor.normalize('abc123')).toBe('abc');
    });

    test('preserves spaces', () => {
      expect(processor.normalize('hello world')).toBe('hello world');
    });

    test('returns empty string for null', () => {
      expect(processor.normalize(null)).toBe('');
    });

    test('returns empty string for undefined', () => {
      expect(processor.normalize(undefined)).toBe('');
    });

    test('returns empty string for non-string', () => {
      expect(processor.normalize(123)).toBe('');
    });

    test('returns empty string for empty string', () => {
      expect(processor.normalize('')).toBe('');
    });

    test('handles special characters', () => {
      expect(processor.normalize('café résumé')).toBe('caf rsum');
    });
  });

  describe('mapToViseme', () => {
    test('maps vowels correctly', () => {
      expect(processor.mapToViseme('a')).toBe(1);
      expect(processor.mapToViseme('e')).toBe(3);
      expect(processor.mapToViseme('i')).toBe(3);
      expect(processor.mapToViseme('o')).toBe(2);
      expect(processor.mapToViseme('u')).toBe(4);
    });

    test('maps consonants correctly', () => {
      expect(processor.mapToViseme('p')).toBe(5);
      expect(processor.mapToViseme('b')).toBe(5);
      expect(processor.mapToViseme('m')).toBe(5);
      expect(processor.mapToViseme('f')).toBe(6);
      expect(processor.mapToViseme('v')).toBe(6);
      expect(processor.mapToViseme('s')).toBe(8);
      expect(processor.mapToViseme('z')).toBe(8);
    });

    test('maps digraphs correctly', () => {
      expect(processor.mapToViseme('th')).toBe(7);
      expect(processor.mapToViseme('sh')).toBe(8);
      expect(processor.mapToViseme('ch')).toBe(8);
      expect(processor.mapToViseme('ee')).toBe(3);
      expect(processor.mapToViseme('oo')).toBe(4);
    });

    test('returns 0 for empty input', () => {
      expect(processor.mapToViseme('')).toBe(0);
    });

    test('returns 0 for null input', () => {
      expect(processor.mapToViseme(null)).toBe(0);
    });

    test('handles uppercase', () => {
      expect(processor.mapToViseme('A')).toBe(1);
      expect(processor.mapToViseme('TH')).toBe(7);
    });
  });

  describe('processText', () => {
    test('returns empty array for empty text', () => {
      expect(processor.processText('')).toEqual([]);
    });

    test('returns empty array for null text', () => {
      expect(processor.processText(null)).toEqual([]);
    });

    test('returns empty array for punctuation-only text', () => {
      expect(processor.processText('!!!')).toEqual([]);
    });

    test('processes a single word', () => {
      const result = processor.processText('cat', 1000);
      expect(result.length).toBeGreaterThan(0);
      // 'c' -> 8, 'a' -> 1, 't' -> 8, plus rest between words
      expect(result[0].viseme).toBe(8); // c
      expect(result[1].viseme).toBe(1); // a
      expect(result[2].viseme).toBe(8); // t
    });

    test('adds rest viseme between words', () => {
      const result = processor.processText('hi you', 1000);
      // 'h' -> 1, 'i' -> 3, rest, 'y' -> 3, 'o' -> 2, 'u' -> 4, rest
      const restVisemes = result.filter(v => v.viseme === 0);
      expect(restVisemes.length).toBeGreaterThanOrEqual(2);
    });

    test('handles digraphs in text', () => {
      const result = processor.processText('the', 1000);
      // 'th' -> 7 (digraph), 'e' -> 3
      expect(result[0].viseme).toBe(7); // th
      expect(result[1].viseme).toBe(3); // e
    });

    test('includes timestamps', () => {
      const result = processor.processText('abc', 1000);
      expect(result[0].timestamp).toBe(1000);
      expect(result[1].timestamp).toBeGreaterThan(result[0].timestamp);
    });

    test('includes durations', () => {
      const result = processor.processText('abc', 1000);
      // Filter out rest visemes between words (50ms hardcoded)
      const nonRestVisemes = result.filter(v => v.viseme !== 0);
      nonRestVisemes.forEach(v => {
        expect(v.duration).toBeGreaterThanOrEqual(processor.minDuration);
        expect(v.duration).toBeLessThanOrEqual(processor.maxDuration);
      });
    });

    test('vowels get longer duration than consonants', () => {
      const result = processor.processText('as', 1000);
      const vowelDuration = result[0].duration; // 'a' is a vowel
      const consonantDuration = result[1].duration; // 's' is a consonant
      expect(vowelDuration).toBeGreaterThan(consonantDuration);
    });

    test('processes multi-word text', () => {
      const result = processor.processText('hello world', 1000);
      expect(result.length).toBeGreaterThan(5); // At least one viseme per character + rests
    });

    test('uses default timestamp when not provided', () => {
      const result = processor.processText('hi');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].timestamp).toBeDefined();
    });
  });

  describe('viseme queue operations', () => {
    test('addTextChunk adds to queue', () => {
      processor.addTextChunk('hello');
      expect(processor.getQueueLength()).toBeGreaterThan(0);
    });

    test('getNextViseme returns and removes first item', () => {
      processor.addTextChunk('hi');
      const first = processor.peekNextViseme();
      const popped = processor.getNextViseme();
      expect(popped).toEqual(first);
      expect(processor.getQueueLength()).toBeLessThan(3); // 'h', 'i', rest = 3 total, minus 1
    });

    test('getNextViseme returns null when empty', () => {
      expect(processor.getNextViseme()).toBeNull();
    });

    test('peekNextViseme returns first item without removing', () => {
      processor.addTextChunk('hi');
      const len = processor.getQueueLength();
      const item = processor.peekNextViseme();
      expect(processor.getQueueLength()).toBe(len);
      expect(item).toBeDefined();
    });

    test('peekNextViseme returns null when empty', () => {
      expect(processor.peekNextViseme()).toBeNull();
    });

    test('clearQueue empties the queue', () => {
      processor.addTextChunk('hello world');
      expect(processor.getQueueLength()).toBeGreaterThan(0);
      processor.clearQueue();
      expect(processor.getQueueLength()).toBe(0);
    });

    test('multiple addTextChunk calls accumulate', () => {
      processor.addTextChunk('hi');
      const len1 = processor.getQueueLength();
      processor.addTextChunk('there');
      expect(processor.getQueueLength()).toBeGreaterThan(len1);
    });
  });

  describe('_computeDuration', () => {
    test('vowels get 120ms base duration', () => {
      const duration = processor._computeDuration('hello', 1); // 'e' is vowel
      expect(duration).toBe(120);
    });

    test('consonants get 90ms base duration', () => {
      const duration = processor._computeDuration('hello', 0); // 'h' is consonant
      expect(duration).toBe(90);
    });

    test('respects minDuration', () => {
      processor.minDuration = 200;
      const duration = processor._computeDuration('hello', 0);
      expect(duration).toBeGreaterThanOrEqual(200);
    });

    test('respects maxDuration', () => {
      processor.minDuration = 30; // Lower min so max can take effect
      processor.maxDuration = 50;
      const duration = processor._computeDuration('hello', 1);
      expect(duration).toBeLessThanOrEqual(50);
    });
  });
});
