/**
 * AudioWorklet processor for low-latency audio analysis.
 * Runs in a separate thread for real-time audio processing.
 * Computes RMS volume per buffer and posts to main thread.
 */
class LipSyncAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._smoothedRMS = 0;
    this._alpha = 0.7; // Exponential moving average smoothing factor
    this._threshold = 0.1; // Peak detection threshold
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      this.port.postMessage({ rms: 0, peak: false, smoothedRMS: 0 });
      return true;
    }

    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      this.port.postMessage({ rms: 0, peak: false, smoothedRMS: 0 });
      return true;
    }

    // Compute RMS
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);

    // Exponential moving average smoothing
    this._smoothedRMS = this._alpha * rms + (1 - this._alpha) * this._smoothedRMS;

    // Peak detection
    const peak = this._smoothedRMS > this._threshold;

    this.port.postMessage({
      rms: rms,
      smoothedRMS: this._smoothedRMS,
      peak: peak
    });

    return true;
  }
}

registerProcessor('lip-sync-audio-processor', LipSyncAudioProcessor);
