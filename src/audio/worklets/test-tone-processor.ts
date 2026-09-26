import { ClickVoice } from "../metronome/click-voice";
import { InputLevelMeter } from "../input/input-meter";
import { InputMonitorGate } from "../input/input-monitor";
import { PcmStation } from "../loop/pcm-station";
import { AudioFrameClock, isTransportConfig } from "../transport/audio-frame-clock";
import { PPQ } from "../transport/timing";
import { WORKLET_PROTOCOL_VERSION } from "../engine/worklet-protocol";

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
  private readonly loop = new PcmStation(this.clock, sampleRate, this.port);
  private blockFrames = 0;
  private readySent = false;
  private phase = 0;
  private level = 0;
  private enabled = false;
  private metronomeEnabled = false;
  private metronomeDirty = true;
  private transportDirty = true;
  private framesSinceSnapshot = 0;
  private readonly inputMeter = new InputLevelMeter();
  private readonly inputMonitor = new InputMonitorGate();
  private inputRevision = 0;
  private inputActive = false;
  private inputFramesSinceSnapshot = 0;
  private readonly phaseStep = (2 * Math.PI * 440) / sampleRate;
  private readonly envelopeStep = 1 / (sampleRate * 0.01);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data !== "object" || data === null || !("type" in data)) return;
      this.loop.handle(data, this.blockFrames, this.inputActive);
      if (typeof data.type === "string" && data.type.startsWith("loop-")) this.transportDirty = true;

      if (data.type === "start") {
        this.enabled = true;
        this.port.postMessage({ type: "playing" });
      } else if (data.type === "stop") {
        this.enabled = false;
        this.port.postMessage({ type: "stopped" });
      } else if (data.type === "transport-start") {
        this.clock.start();
        this.loop.play(this.blockFrames);
        this.transportDirty = true;
      } else if (data.type === "transport-stop") {
        this.loop.stop();
        this.clock.stop();
        this.transportDirty = true;
      } else if (data.type === "transport-reset") {
        this.loop.stop();
        this.clock.reset();
        this.transportDirty = true;
      } else if (data.type === "transport-configure" && "config" in data && isTransportConfig(data.config)) {
        if (!this.loop.locked) this.clock.configure(data.config);
        this.transportDirty = true;
      } else if (data.type === "metronome-enable" && "enabled" in data && typeof data.enabled === "boolean") {
        this.metronomeEnabled = data.enabled;
        this.metronomeDirty = true;
      } else if (data.type === "input-route" && "revision" in data && typeof data.revision === "number" && Number.isSafeInteger(data.revision) && "active" in data && typeof data.active === "boolean") {
        if (!this.inputMonitor.route(data.revision, data.active)) return;
        this.loop.interrupt();
        this.inputRevision = data.revision;
        this.inputActive = data.active;
        this.inputFramesSinceSnapshot = 0;
        this.inputMeter.reset();
      } else if (data.type === "input-clear-clip" && "revision" in data && data.revision === this.inputRevision) {
        this.inputMeter.clearClip();
      } else if (data.type === "input-monitor") {
        const applied = this.inputMonitor.configure(data);
        if (applied) this.port.postMessage(applied);
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0];
    const clickChannels = outputs[1];
    const input = this.inputActive ? inputs[0]?.[0] : undefined;
    const monitor = outputs[2]?.[0];
    const loopLeft = outputs[3]?.[0];
    const loopRight = outputs[3]?.[1];
    const frameCount = channels?.[0]?.length ?? 0;
    this.blockFrames = frameCount;
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
      const inputSample = input?.[frame];
      const sample = inputSample !== undefined && Number.isFinite(inputSample) ? inputSample : 0;
      this.loop.nextSample(inputSample, blockPositionFrame + frame);
      if (loopLeft && frame < loopLeft.length) loopLeft[frame] = this.loop.left;
      if (loopRight && frame < loopRight.length) loopRight[frame] = this.loop.right;
      if (inputSample !== undefined) this.inputMeter.add(sample);
      // Monitor limiting never changes the PCM captured by the loop above.
      if (monitor && frame < monitor.length) monitor[frame] = this.inputMonitor.nextSample(sample, this.loop.inputCaptured);
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
    if (this.inputActive) {
      this.inputFramesSinceSnapshot += frameCount;
      if (this.inputFramesSinceSnapshot >= sampleRate / 10) {
        this.port.postMessage(this.inputMeter.snapshot(this.inputRevision));
        this.inputFramesSinceSnapshot = 0;
      }
    }
    this.framesSinceSnapshot = this.clock.playing ? this.framesSinceSnapshot + frameCount : 0;
    const refresh = this.framesSinceSnapshot >= sampleRate / 10;
    this.loop.publish(refresh);
    if (this.transportDirty || refresh) {
      this.port.postMessage(this.clock.snapshot(currentFrame + frameCount));
      this.transportDirty = false;
      this.framesSinceSnapshot = 0;
    }
    if (this.metronomeDirty) {
      this.port.postMessage({ type: "metronome", enabled: this.metronomeEnabled });
      this.metronomeDirty = false;
    }

    if (!this.readySent && frameCount > 0) {
      this.readySent = true;
      this.port.postMessage({ type: "worklet-ready", version: WORKLET_PROTOCOL_VERSION, sampleRate, blockFrames: frameCount });
    }

    return true;
  }
}

registerProcessor("loop-station-test-tone", TestToneProcessor);
