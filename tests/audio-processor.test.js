/**
 * Tests for AudioProcessor module.
 */
const AudioProcessor = require('../js/audio-processor');

describe('AudioProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new AudioProcessor();
  });

  describe('constructor', () => {
    test('initializes with default values', () => {
      expect(processor.rms).toBe(0);
      expect(processor.smoothedRMS).toBe(0);
      expect(processor.peak).toBe(false);
      expect(processor.alpha).toBe(0.7);
      expect(processor.threshold).toBe(0.1);
      expect(processor.bufferSize).toBe(1024);
      expect(processor._started).toBe(false);
    });

    test('starts with null audio context and nodes', () => {
      expect(processor.audioContext).toBeNull();
      expect(processor.sourceNode).toBeNull();
      expect(processor.workletNode).toBeNull();
      expect(processor.stream).toBeNull();
    });
  });

  describe('onAudioData', () => {
    test('registers a callback', () => {
      const callback = jest.fn();
      processor.onAudioData(callback);
      expect(processor._onAudioData).toBe(callback);
    });

    test('can register null callback', () => {
      processor.onAudioData(null);
      expect(processor._onAudioData).toBeNull();
    });
  });

  describe('computeRMS (static)', () => {
    test('returns zero for empty data', () => {
      const result = AudioProcessor.computeRMS([], 0, 0.7, 0.1);
      expect(result.rms).toBe(0);
      expect(result.smoothedRMS).toBe(0);
      expect(result.peak).toBe(false);
    });

    test('returns zero for null data', () => {
      const result = AudioProcessor.computeRMS(null, 0, 0.7, 0.1);
      expect(result.rms).toBe(0);
      expect(result.peak).toBe(false);
    });

    test('computes correct RMS for constant signal', () => {
      const data = new Float32Array(100).fill(0.5);
      const result = AudioProcessor.computeRMS(data, 0, 0.7, 0.1);
      expect(result.rms).toBeCloseTo(0.5, 5);
    });

    test('computes correct RMS for silence', () => {
      const data = new Float32Array(100).fill(0);
      const result = AudioProcessor.computeRMS(data, 0, 0.7, 0.1);
      expect(result.rms).toBe(0);
      expect(result.peak).toBe(false);
    });

    test('applies exponential smoothing correctly', () => {
      const data = new Float32Array(100).fill(1.0);
      const result = AudioProcessor.computeRMS(data, 0.5, 0.7, 0.1);
      // smoothed = 0.7 * 1.0 + 0.3 * 0.5 = 0.85
      expect(result.smoothedRMS).toBeCloseTo(0.85, 5);
    });

    test('detects peaks above threshold', () => {
      const data = new Float32Array(100).fill(0.5);
      const result = AudioProcessor.computeRMS(data, 0, 0.7, 0.1);
      // smoothed = 0.7 * 0.5 = 0.35, which is > 0.1
      expect(result.peak).toBe(true);
    });

    test('no peak detection below threshold', () => {
      const data = new Float32Array(100).fill(0.01);
      const result = AudioProcessor.computeRMS(data, 0, 0.7, 0.1);
      expect(result.peak).toBe(false);
    });

    test('handles varying signal levels', () => {
      const data = new Float32Array(4);
      data[0] = 0.0;
      data[1] = 1.0;
      data[2] = 0.0;
      data[3] = -1.0;
      const result = AudioProcessor.computeRMS(data, 0, 0.7, 0.1);
      // RMS = sqrt((0 + 1 + 0 + 1) / 4) = sqrt(0.5) ≈ 0.707
      expect(result.rms).toBeCloseTo(Math.sqrt(0.5), 5);
    });

    test('handles previous smoothed value of undefined', () => {
      const data = new Float32Array(100).fill(0.5);
      const result = AudioProcessor.computeRMS(data, undefined, 0.7, 0.1);
      // smoothed = 0.7 * 0.5 + 0.3 * 0 = 0.35
      expect(result.smoothedRMS).toBeCloseTo(0.35, 5);
    });
  });

  describe('getEnergy', () => {
    test('returns 0 when smoothedRMS is 0', () => {
      processor.smoothedRMS = 0;
      expect(processor.getEnergy()).toBe(0);
    });

    test('returns scaled energy value', () => {
      processor.smoothedRMS = 0.1;
      expect(processor.getEnergy()).toBeCloseTo(0.5, 5);
    });

    test('caps at 1.0', () => {
      processor.smoothedRMS = 0.5;
      expect(processor.getEnergy()).toBe(1);
    });

    test('returns 1.0 for very high values', () => {
      processor.smoothedRMS = 10;
      expect(processor.getEnergy()).toBe(1);
    });
  });

  describe('isStarted', () => {
    test('returns false initially', () => {
      expect(processor.isStarted()).toBe(false);
    });
  });

  describe('stop', () => {
    test('resets all state', () => {
      processor.rms = 0.5;
      processor.smoothedRMS = 0.3;
      processor.peak = true;
      processor._started = true;

      processor.stop();

      expect(processor.rms).toBe(0);
      expect(processor.smoothedRMS).toBe(0);
      expect(processor.peak).toBe(false);
      expect(processor._started).toBe(false);
      expect(processor.audioContext).toBeNull();
      expect(processor.sourceNode).toBeNull();
      expect(processor.stream).toBeNull();
    });

    test('disconnects worklet node if present', () => {
      const mockDisconnect = jest.fn();
      processor.workletNode = { disconnect: mockDisconnect };
      processor.stop();
      expect(mockDisconnect).toHaveBeenCalled();
      expect(processor.workletNode).toBeNull();
    });

    test('disconnects script processor if present', () => {
      const mockDisconnect = jest.fn();
      processor._scriptProcessor = { disconnect: mockDisconnect };
      processor.stop();
      expect(mockDisconnect).toHaveBeenCalled();
      expect(processor._scriptProcessor).toBeNull();
    });

    test('stops media stream tracks', () => {
      const mockStop = jest.fn();
      processor.stream = { getTracks: () => [{ stop: mockStop }] };
      processor.stop();
      expect(mockStop).toHaveBeenCalled();
    });

    test('closes audio context', () => {
      const mockClose = jest.fn();
      processor.audioContext = { close: mockClose };
      processor.stop();
      expect(mockClose).toHaveBeenCalled();
      expect(processor.audioContext).toBeNull();
    });

    test('handles stop when nothing is initialized', () => {
      expect(() => processor.stop()).not.toThrow();
    });
  });

  describe('start', () => {
    test('does nothing if already started', async () => {
      processor._started = true;
      await processor.start();
      // Should not throw, should not set audioContext
      expect(processor.audioContext).toBeNull();
    });
  });
});
