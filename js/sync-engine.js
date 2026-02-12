/**
 * SyncEngine - Aligns text-derived visemes with audio energy peaks.
 *
 * Hybrid timing:
 * - Primary: Audio energy peaks trigger viseme transitions.
 * - Secondary: Text-derived viseme timings stretched/shifted to match syllable peaks.
 * - Buffer: 200-500ms lookahead queue for predictive blending.
 * - Interpolation: Linear lerp between current/next viseme (50ms transitions).
 * - Silence: Fade to Viseme 0 after 300ms no energy.
 */
class SyncEngine {
  constructor() {
    this.currentViseme = 0;
    this.targetViseme = 0;
    this.blendFactor = 1.0; // 0 = currentViseme, 1 = targetViseme
    this.transitionDuration = 50; // ms for lerp transitions
    this.silenceTimeout = 300; // ms before returning to rest
    this.lastEnergyTime = 0;
    this.lastUpdateTime = 0;

    this.visemeQueue = []; // Lookahead queue
    this.lookaheadMs = 300; // Lookahead buffer window

    this.audioEnergy = 0;
    this.audioPeak = false;

    this._transitionStart = 0;
    this._transitionFrom = 0;
    this._transitionTo = 0;
    this._inTransition = false;

    this.mode = 'hybrid'; // 'hybrid', 'audio-only', 'text-only'
  }

  /**
   * Feed audio analysis data into the sync engine.
   * @param {{rms: number, smoothedRMS: number, peak: boolean}} audioData
   */
  updateAudio(audioData) {
    this.audioEnergy = audioData.smoothedRMS || 0;
    this.audioPeak = audioData.peak || false;

    if (this.audioEnergy > 0.02) {
      this.lastEnergyTime = this._now();
    }
  }

  /**
   * Feed a sequence of visemes from text processing.
   * @param {Array<{viseme: number, duration: number, timestamp: number}>} visemes
   */
  feedVisemes(visemes) {
    if (!visemes || visemes.length === 0) return;
    this.visemeQueue.push(...visemes);
    // Limit queue size
    if (this.visemeQueue.length > 100) {
      this.visemeQueue = this.visemeQueue.slice(-100);
    }
  }

  /**
   * Main update loop - call this each frame.
   * @param {number} [now] - Current time in ms
   * @returns {{viseme: number, blendFactor: number, energy: number, nextViseme: number}}
   */
  update(now) {
    const currentTime = now || this._now();
    const dt = currentTime - (this.lastUpdateTime || currentTime);
    this.lastUpdateTime = currentTime;

    let result;

    if (this.mode === 'audio-only') {
      result = this._updateAudioOnly(currentTime, dt);
    } else if (this.mode === 'text-only') {
      result = this._updateTextOnly(currentTime, dt);
    } else {
      result = this._updateHybrid(currentTime, dt);
    }

    return result;
  }

  /**
   * Audio-only mode: Use energy level to determine mouth openness.
   * Maps energy to visemes: low = rest, medium = partially open, high = wide open.
   */
  _updateAudioOnly(now, dt) {
    const timeSinceEnergy = now - this.lastEnergyTime;

    if (timeSinceEnergy > this.silenceTimeout) {
      this._startTransition(0, now);
    } else {
      const energy = Math.min(1, this.audioEnergy * 5);
      if (energy > 0.8) {
        this._startTransition(1, now);  // Aa — wide open
      } else if (energy > 0.6) {
        this._startTransition(7, now);  // Oh — rounded open
      } else if (energy > 0.4) {
        this._startTransition(10, now); // Uh — slightly open
      } else if (energy > 0.2) {
        this._startTransition(3, now);  // Ee — smile
      } else if (energy > 0.1) {
        this._startTransition(6, now);  // M — lips pressed
      } else {
        this._startTransition(0, now);  // Neutral — rest
      }
    }

    this._updateTransition(now);
    return this._getState();
  }

  /**
   * Text-only mode: Use queued visemes with fixed timing.
   */
  _updateTextOnly(now, dt) {
    this._processQueue(now);
    this._updateTransition(now);
    return this._getState();
  }

  /**
   * Hybrid mode: Combine audio energy with text-derived visemes.
   * Audio peaks trigger transitions; text provides which viseme to show.
   */
  _updateHybrid(now, dt) {
    const timeSinceEnergy = now - this.lastEnergyTime;

    // Silence detection
    if (timeSinceEnergy > this.silenceTimeout) {
      this._startTransition(0, now);
      this._updateTransition(now);
      return this._getState();
    }

    // If we have text-derived visemes, use them with audio timing
    if (this.visemeQueue.length > 0) {
      if (this.audioPeak || this._shouldAdvanceQueue(now)) {
        this._processQueue(now);
      }
    } else {
      // Fall back to audio-only behavior
      return this._updateAudioOnly(now, dt);
    }

    this._updateTransition(now);
    return this._getState();
  }

  /**
   * Check if we should advance the queue based on timing.
   */
  _shouldAdvanceQueue(now) {
    if (this.visemeQueue.length === 0) return false;
    const next = this.visemeQueue[0];
    return now >= next.timestamp;
  }

  /**
   * Process the next viseme from the queue.
   */
  _processQueue(now) {
    if (this.visemeQueue.length === 0) return;

    // Remove expired visemes
    while (this.visemeQueue.length > 0) {
      const next = this.visemeQueue[0];
      const expiryTime = next.timestamp + next.duration;
      if (now > expiryTime + this.lookaheadMs) {
        this.visemeQueue.shift();
      } else {
        break;
      }
    }

    if (this.visemeQueue.length > 0) {
      const next = this.visemeQueue.shift();
      this._startTransition(next.viseme, now);
    }
  }

  /**
   * Begin a viseme transition.
   */
  _startTransition(targetViseme, now) {
    if (targetViseme === this.targetViseme && this._inTransition) return;

    this._transitionFrom = this.currentViseme;
    this._transitionTo = targetViseme;
    this._transitionStart = now;
    this._inTransition = true;
    this.targetViseme = targetViseme;
  }

  /**
   * Update the blend factor for the current transition.
   */
  _updateTransition(now) {
    if (!this._inTransition) {
      this.blendFactor = 1.0;
      return;
    }

    const elapsed = now - this._transitionStart;
    const progress = Math.min(1, elapsed / this.transitionDuration);

    this.blendFactor = progress;

    if (progress >= 1) {
      this.currentViseme = this._transitionTo;
      this._inTransition = false;
      this.blendFactor = 1.0;
    }
  }

  /**
   * Get current sync state for the renderer.
   */
  _getState() {
    return {
      viseme: this._inTransition ? this._transitionFrom : this.currentViseme,
      nextViseme: this._transitionTo,
      blendFactor: this.blendFactor,
      energy: Math.min(1, this.audioEnergy * 5)
    };
  }

  /**
   * Set the sync mode.
   * @param {'hybrid'|'audio-only'|'text-only'} mode
   */
  setMode(mode) {
    if (['hybrid', 'audio-only', 'text-only'].includes(mode)) {
      this.mode = mode;
    }
  }

  /**
   * Clear all state and queues.
   */
  reset() {
    this.currentViseme = 0;
    this.targetViseme = 0;
    this.blendFactor = 1.0;
    this.visemeQueue = [];
    this.audioEnergy = 0;
    this.audioPeak = false;
    this.lastEnergyTime = 0;
    this.lastUpdateTime = 0;
    this._inTransition = false;
  }

  _now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncEngine;
}
