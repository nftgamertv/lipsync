class AudioChunkProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = (options.processorOptions && options.processorOptions.chunkSize) || 1024;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channel = input[0];
    let i = 0;
    while (i < channel.length) {
      const remaining = this.bufferSize - this.offset;
      const toCopy = Math.min(remaining, channel.length - i);
      this.buffer.set(channel.subarray(i, i + toCopy), this.offset);
      this.offset += toCopy;
      i += toCopy;

      if (this.offset >= this.bufferSize) {
        this.port.postMessage({ chunk: this.buffer.slice() });
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("audio-chunk-processor", AudioChunkProcessor);
