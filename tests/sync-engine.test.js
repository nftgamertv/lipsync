/**
 * Tests for SyncEngine module.
 */
const SyncEngine = require('../js/sync-engine');

describe('SyncEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SyncEngine();
  });

  describe('constructor', () => {
    test('initializes with default values', () => {
      expect(engine.currentViseme).toBe(0);
      expect(engine.targetViseme).toBe(0);
      expect(engine.blendFactor).toBe(1.0);
      expect(engine.transitionDuration).toBe(50);
      expect(engine.silenceTimeout).toBe(300);
      expect(engine.mode).toBe('hybrid');
      expect(engine.visemeQueue).toEqual([]);
    });

    test('starts with no audio energy', () => {
      expect(engine.audioEnergy).toBe(0);
      expect(engine.audioPeak).toBe(false);
    });
  });

  describe('updateAudio', () => {
    test('updates audio energy and peak', () => {
      engine.updateAudio({ rms: 0.5, smoothedRMS: 0.3, peak: true });
      expect(engine.audioEnergy).toBe(0.3);
      expect(engine.audioPeak).toBe(true);
    });

    test('updates lastEnergyTime when energy is above threshold', () => {
      engine.updateAudio({ rms: 0.5, smoothedRMS: 0.1, peak: true });
      expect(engine.lastEnergyTime).toBeGreaterThan(0);
    });

    test('does not update lastEnergyTime for very low energy', () => {
      engine.lastEnergyTime = 0;
      engine.updateAudio({ rms: 0.001, smoothedRMS: 0.001, peak: false });
      expect(engine.lastEnergyTime).toBe(0);
    });

    test('handles missing smoothedRMS', () => {
      engine.updateAudio({ rms: 0.5 });
      expect(engine.audioEnergy).toBe(0);
    });
  });

  describe('feedVisemes', () => {
    test('adds visemes to queue', () => {
      engine.feedVisemes([
        { viseme: 1, duration: 100, timestamp: 1000 },
        { viseme: 2, duration: 100, timestamp: 1100 }
      ]);
      expect(engine.visemeQueue.length).toBe(2);
    });

    test('handles null input', () => {
      engine.feedVisemes(null);
      expect(engine.visemeQueue.length).toBe(0);
    });

    test('handles empty array', () => {
      engine.feedVisemes([]);
      expect(engine.visemeQueue.length).toBe(0);
    });

    test('limits queue size to 100', () => {
      const visemes = Array.from({ length: 120 }, (_, i) => ({
        viseme: i % 12,
        duration: 100,
        timestamp: i * 100
      }));
      engine.feedVisemes(visemes);
      expect(engine.visemeQueue.length).toBe(100);
    });

    test('accumulates visemes from multiple calls', () => {
      engine.feedVisemes([{ viseme: 1, duration: 100, timestamp: 1000 }]);
      engine.feedVisemes([{ viseme: 2, duration: 100, timestamp: 1100 }]);
      expect(engine.visemeQueue.length).toBe(2);
    });
  });

  describe('setMode', () => {
    test('sets hybrid mode', () => {
      engine.setMode('hybrid');
      expect(engine.mode).toBe('hybrid');
    });

    test('sets audio-only mode', () => {
      engine.setMode('audio-only');
      expect(engine.mode).toBe('audio-only');
    });

    test('sets text-only mode', () => {
      engine.setMode('text-only');
      expect(engine.mode).toBe('text-only');
    });

    test('ignores invalid mode', () => {
      engine.setMode('invalid');
      expect(engine.mode).toBe('hybrid');
    });
  });

  describe('update', () => {
    test('returns state object with expected properties', () => {
      const state = engine.update(1000);
      expect(state).toHaveProperty('viseme');
      expect(state).toHaveProperty('nextViseme');
      expect(state).toHaveProperty('blendFactor');
      expect(state).toHaveProperty('energy');
    });

    test('returns rest viseme (0) with no input', () => {
      const state = engine.update(1000);
      expect(state.viseme).toBe(0);
    });

    test('updates lastUpdateTime', () => {
      engine.update(1000);
      expect(engine.lastUpdateTime).toBe(1000);
    });
  });

  describe('audio-only mode', () => {
    beforeEach(() => {
      engine.setMode('audio-only');
    });

    test('returns rest viseme on silence', () => {
      engine.lastEnergyTime = 0;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(0);
    });

    test('returns Aa (wide open) for very high energy', () => {
      engine.audioEnergy = 0.5;  // energy * 5 = 2.5, capped to 1.0 > 0.8
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(1); // Aa
    });

    test('returns Oh (rounded) for high energy', () => {
      engine.audioEnergy = 0.14;  // energy * 5 = 0.7 > 0.6
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(7); // Oh
    });

    test('returns Uh for medium energy', () => {
      engine.audioEnergy = 0.1;  // energy * 5 = 0.5 > 0.4
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(10); // Uh
    });

    test('returns Ee for low-medium energy', () => {
      engine.audioEnergy = 0.05;  // energy * 5 = 0.25 > 0.2
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(3); // Ee
    });

    test('returns M for low energy', () => {
      engine.audioEnergy = 0.03;  // energy * 5 = 0.15 > 0.1
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(6); // M
    });

    test('returns rest for very low energy', () => {
      engine.audioEnergy = 0.01;  // energy * 5 = 0.05 < 0.1
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(0);
    });

    test('fades to rest after silence timeout', () => {
      engine.audioEnergy = 0;
      engine.lastEnergyTime = 500;
      const state = engine.update(1000); // 500ms since energy > 300ms timeout
      expect(state.nextViseme).toBe(0);
    });
  });

  describe('text-only mode', () => {
    beforeEach(() => {
      engine.setMode('text-only');
    });

    test('processes queued visemes', () => {
      engine.feedVisemes([
        { viseme: 3, duration: 100, timestamp: 900 }
      ]);
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(3);
    });

    test('returns rest when queue is empty', () => {
      const state = engine.update(1000);
      expect(state.viseme).toBe(0);
    });
  });

  describe('hybrid mode', () => {
    test('falls back to audio-only when no text visemes', () => {
      engine.audioEnergy = 0.5;
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(1); // Aa — same as audio-only high energy
    });

    test('uses text visemes when available and audio peak detected', () => {
      engine.feedVisemes([
        { viseme: 5, duration: 100, timestamp: 900 }
      ]);
      engine.audioPeak = true;
      engine.lastEnergyTime = 999;
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(5);
    });

    test('silence detection returns rest viseme', () => {
      engine.lastEnergyTime = 0;
      engine.feedVisemes([
        { viseme: 3, duration: 100, timestamp: 1000 }
      ]);
      const state = engine.update(1000);
      expect(state.nextViseme).toBe(0);
    });
  });

  describe('transitions', () => {
    test('blend factor progresses over transition duration', () => {
      engine.setMode('audio-only');
      engine.audioEnergy = 0.5;
      engine.lastEnergyTime = 100;

      // First update starts a transition
      engine.update(100);

      // Midway through transition (25ms into 50ms transition)
      const midState = engine.update(125);
      expect(midState.blendFactor).toBeCloseTo(0.5, 1);
    });

    test('transition completes after transitionDuration', () => {
      engine.setMode('audio-only');
      engine.audioEnergy = 0.5;
      engine.lastEnergyTime = 100;

      engine.update(100);
      const finalState = engine.update(200); // well past 50ms
      expect(finalState.blendFactor).toBe(1.0);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      engine.currentViseme = 5;
      engine.targetViseme = 3;
      engine.audioEnergy = 0.5;
      engine.audioPeak = true;
      engine.feedVisemes([{ viseme: 1, duration: 100, timestamp: 1000 }]);

      engine.reset();

      expect(engine.currentViseme).toBe(0);
      expect(engine.targetViseme).toBe(0);
      expect(engine.blendFactor).toBe(1.0);
      expect(engine.visemeQueue).toEqual([]);
      expect(engine.audioEnergy).toBe(0);
      expect(engine.audioPeak).toBe(false);
      expect(engine.lastEnergyTime).toBe(0);
      expect(engine.lastUpdateTime).toBe(0);
      expect(engine._inTransition).toBe(false);
    });
  });

  describe('_shouldAdvanceQueue', () => {
    test('returns false for empty queue', () => {
      expect(engine._shouldAdvanceQueue(1000)).toBe(false);
    });

    test('returns true when current time >= next timestamp', () => {
      engine.feedVisemes([{ viseme: 1, duration: 100, timestamp: 900 }]);
      expect(engine._shouldAdvanceQueue(1000)).toBe(true);
    });

    test('returns false when current time < next timestamp', () => {
      engine.feedVisemes([{ viseme: 1, duration: 100, timestamp: 2000 }]);
      expect(engine._shouldAdvanceQueue(1000)).toBe(false);
    });
  });

  describe('_startTransition', () => {
    test('begins a new transition', () => {
      engine._startTransition(3, 1000);
      expect(engine._inTransition).toBe(true);
      expect(engine._transitionTo).toBe(3);
      expect(engine.targetViseme).toBe(3);
    });

    test('skips if already transitioning to same target', () => {
      engine._startTransition(3, 1000);
      const startTime = engine._transitionStart;
      engine._startTransition(3, 1100);
      expect(engine._transitionStart).toBe(startTime); // Unchanged
    });
  });
});
