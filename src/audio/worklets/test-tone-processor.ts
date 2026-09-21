import { ClickVoice } from "../metronome/click-voice";
import { AudioFrameClock, isTransportConfig } from "../transport/audio-frame-clock";
import { PPQ } from "../transport/timing";

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
  private readonly click = new ClickVoice(sampleRate);
  private phase = 0;
  private level = 0;
  private enabled = false;
  private metronomeEnabled = false;
  private metronomeDirty = true;
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
      } else if (data.type === "metronome-enable" && "enabled" in data && typeof data.enabled === "boolean") {
        this.metronomeEnabled = data.enabled;
        this.metronomeDirty = true;
      }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0];
    const clickChannels = outputs[1];
    const frameCount = channels?.[0]?.length ?? 0;
    const blockPositionFrame = this.clock.positionFrame;
    let nextBeatFrame = Number.POSITIVE_INFINITY;
    let nextBeatIndex = 0;
    let beatTicks = 0;

    if (this.clock.playing && this.metronomeEnabled) {
      beatTicks = PPQ * 4 / this.clock.meter.denominator;
      nextBeatIndex = Math.max(0, Math.ceil((this.clock.positionTick - 1e-7) / beatTicks));
      nextBeatFrame = this.clock.frameAtTick(nextBeatIndex * beatTicks);
      while (nextBeatFrame < blockPositionFrame) {
        nextBeatIndex += 1;
        nextBeatFrame = this.clock.frameAtTick(nextBeatIndex * beatTicks);
      }
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      if (blockPositionFrame + frame === nextBeatFrame) {
        this.click.trigger(nextBeatIndex % this.clock.meter.numerator === 0);
        nextBeatIndex += 1;
        nextBeatFrame = this.clock.frameAtTick(nextBeatIndex * beatTicks);
      }
      const clickValue = this.click.nextSample(this.clock.playing && this.metronomeEnabled);
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
      if (clickChannels) {
        for (let channel = 0; channel < clickChannels.length; channel += 1) {
          const samples = clickChannels[channel];
          if (frame < samples.length) samples[frame] = clickValue;
        }
      }
    }

    this.clock.advance(frameCount);
    this.framesSinceSnapshot = this.clock.playing ? this.framesSinceSnapshot + frameCount : 0;
    if (this.transportDirty || this.framesSinceSnapshot >= sampleRate / 10) {
      this.port.postMessage(this.clock.snapshot(currentFrame + frameCount));
      this.transportDirty = false;
      this.framesSinceSnapshot = 0;
    }
    if (this.metronomeDirty) {
      this.port.postMessage({ type: "metronome", enabled: this.metronomeEnabled });
      this.metronomeDirty = false;
    }

    return true;
  }
}

registerProcessor("loop-station-test-tone", TestToneProcessor);
