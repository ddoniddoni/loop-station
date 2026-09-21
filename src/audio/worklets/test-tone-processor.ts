import { AudioFrameClock, isTransportConfig } from "../transport/audio-frame-clock";

declare const sampleRate: number;
declare const currentFrame: number;
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor,
): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class TestToneProcessor extends AudioWorkletProcessor {
  private readonly clock = new AudioFrameClock(sampleRate);
  private phase = 0;
  private level = 0;
  private enabled = false;
  private transportDirty = true;
  private framesSinceSnapshot = 0;
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
      } else if (data.type === "transport-start") {
        this.clock.start();
        this.transportDirty = true;
      } else if (data.type === "transport-stop") {
        this.clock.stop();
        this.transportDirty = true;
      } else if (data.type === "transport-reset") {
        this.clock.reset();
        this.transportDirty = true;
      } else if (data.type === "transport-configure" && "config" in data && isTransportConfig(data.config)) {
        this.clock.configure(data.config);
        this.transportDirty = true;
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

    this.clock.advance(frameCount);
    this.framesSinceSnapshot = this.clock.playing ? this.framesSinceSnapshot + frameCount : 0;
    if (this.transportDirty || this.framesSinceSnapshot >= sampleRate / 10) {
      this.port.postMessage(this.clock.snapshot(currentFrame + frameCount));
      this.transportDirty = false;
      this.framesSinceSnapshot = 0;
    }

    return true;
  }
}

registerProcessor("loop-station-test-tone", TestToneProcessor);
