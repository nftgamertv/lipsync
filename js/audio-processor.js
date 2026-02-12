/**
 * AudioProcessor - Captures live audio via Web Audio API.
 * Computes RMS volume, detects peaks, and provides smoothed energy values.
 * Uses AudioWorklet for low-latency processing when available,
 * falls back to ScriptProcessorNode.
 */
class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.analyserNode = null;
    this.stream = null;

    this.rms = 0;
    this.smoothedRMS = 0;
    this.peak = false;
    this.alpha = 0.7;
    this.threshold = 0.1;
    this.bufferSize = 1024;

    this._onAudioData = null;
    this._started = false;
    this._useWorklet = false;
    this._scriptProcessor = null;
  }

  /**
   * Register callback for audio data updates.
   * @param {Function} callback - Called with { rms, smoothedRMS, peak }
   */
  onAudioData(callback) {
    this._onAudioData = callback;
  }

  /**
   * Request microphone access and initialize audio processing.
   */
  async start() {
    if (this._started) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    try {
      await this.audioContext.audioWorklet.addModule('js/audio-worklet-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'lip-sync-audio-processor');
      this.workletNode.port.onmessage = (event) => {
        this.rms = event.data.rms;
        this.smoothedRMS = event.data.smoothedRMS;
        this.peak = event.data.peak;
        if (this._onAudioData) {
          this._onAudioData(event.data);
        }
      };
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      this._useWorklet = true;
    } catch (e) {
      // Fallback to ScriptProcessorNode
      this._setupScriptProcessor();
    }

    this._started = true;
  }

  /**
   * Fallback: ScriptProcessorNode-based audio analysis.
   */
  _setupScriptProcessor() {
    this._scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
    this._scriptProcessor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      const result = AudioProcessor.computeRMS(channelData, this.smoothedRMS, this.alpha, this.threshold);
      this.rms = result.rms;
      this.smoothedRMS = result.smoothedRMS;
      this.peak = result.peak;
      if (this._onAudioData) {
        this._onAudioData(result);
      }
    };
    this.sourceNode.connect(this._scriptProcessor);
    this._scriptProcessor.connect(this.audioContext.destination);
  }

  /**
   * Compute RMS, smoothed RMS, and peak detection from audio samples.
   * Static so it can be used from both worklet and main thread fallback.
   */
  static computeRMS(channelData, previousSmoothed, alpha, threshold) {
    if (!channelData || channelData.length === 0) {
      return { rms: 0, smoothedRMS: previousSmoothed || 0, peak: false };
    }

    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);
    const smoothedRMS = alpha * rms + (1 - alpha) * (previousSmoothed || 0);
    const peak = smoothedRMS > threshold;

    return { rms, smoothedRMS, peak };
  }

  /**
   * Get current energy level normalized to 0-1 range.
   */
  getEnergy() {
    return Math.min(1, this.smoothedRMS * 5);
  }

  /**
   * Stop audio capture and clean up resources.
   */
  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this._scriptProcessor) {
      this._scriptProcessor.disconnect();
      this._scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this._started = false;
    this.rms = 0;
    this.smoothedRMS = 0;
    this.peak = false;
  }

  isStarted() {
    return this._started;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioProcessor;
}
