declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor,
): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class TestToneProcessor extends AudioWorkletProcessor {
  private phase = 0;
  private level = 0;
  private enabled = false;
  private readonly phaseStep = (2 * Math.PI * 440) / sampleRate;
  private readonly envelopeStep = 1 / (sampleRate * 0.01);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data !== "object" || data === null || !("type" in data)) return;

      if (data.type === "start") {
        this.enabled = true;
        this.port.postMessage({ type: "playing" });
      } else if (data.type === "stop") {
        this.enabled = false;
        this.port.postMessage({ type: "stopped" });
      }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0];
    const frameCount = channels?.[0]?.length ?? 0;

    for (let frame = 0; frame < frameCount; frame += 1) {
      this.level = this.enabled
        ? Math.min(1, this.level + this.envelopeStep)
        : Math.max(0, this.level - this.envelopeStep);
      const value = this.level > 0 ? Math.sin(this.phase) * this.level * 0.2 : 0;
      this.phase += this.phaseStep;
      if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;

      for (let channel = 0; channel < channels.length; channel += 1) {
        const samples = channels[channel];
        if (frame < samples.length) samples[frame] = value;
      }
    }

    return true;
  }
}

registerProcessor("loop-station-test-tone", TestToneProcessor);
