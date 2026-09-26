import { isTransportSnapshot, type TransportConfig, type TransportSnapshot } from "../transport/audio-frame-clock";
import type { MicrophoneController } from "../input/microphone-controller";
import type { StationController } from "../loop/station-controller";

type EngineCallbacks = {
  onContextStateChange: (state: AudioContextState) => void;
  onToneStateChange: (playing: boolean) => void;
  onTransportStateChange: (snapshot: TransportSnapshot) => void;
  onMetronomeStateChange: (enabled: boolean) => void;
  onProcessorError: () => void;
};

export type AudioSetupErrorCode =
  | "insecure-context"
  | "unsupported"
  | "not-running"
  | "worklet-unavailable"
  | "worklet-load-failed"
  | "disposed";

export class AudioSetupError extends Error {
  constructor(readonly code: AudioSetupErrorCode) {
    super(code);
    this.name = "AudioSetupError";
  }
}

export class TestToneEngine {
  private readonly context: AudioContext;
  private node: AudioWorkletNode | null = null;
  private toneGain: GainNode | null = null;
  private clickGain: GainNode | null = null;
  private loopGain: GainNode | null = null;
  private disposed = false;

  private readonly handleContextStateChange = () => {
    if (this.disposed) return;
    if (this.context.state !== "running") this.stopTone();
    this.input.setAudioRunning(this.context.state === "running");
    this.loop.setRunning(this.context.state === "running");
    this.callbacks.onContextStateChange(this.context.state);
  };

  constructor(private readonly callbacks: EngineCallbacks, private readonly input: MicrophoneController, private readonly loop: StationController) {
    if (!window.isSecureContext) {
      throw new AudioSetupError("insecure-context");
    }
    if (typeof window.AudioContext !== "function" || typeof window.AudioWorkletNode !== "function") {
      throw new AudioSetupError("unsupported");
    }
    this.context = new AudioContext({ latencyHint: "interactive" });
  }

  get sampleRate(): number {
    return this.context.sampleRate;
  }

  get state(): AudioContextState {
    return this.context.state;
  }

  get isReady(): boolean {
    return this.node !== null;
  }

  async initialize(): Promise<void> {
    await this.context.resume();
    this.assertActive();
    if (this.context.state !== "running") {
      throw new AudioSetupError("not-running");
    }
    if (!this.context.audioWorklet) {
      throw new AudioSetupError("worklet-unavailable");
    }

    try {
      await this.context.audioWorklet.addModule("/audio/test-tone-processor.js");
    } catch {
      throw new AudioSetupError("worklet-load-failed");
    }
    this.assertActive();

    const node = new AudioWorkletNode(this.context, "loop-station-test-tone", {
      numberOfInputs: 1,
      numberOfOutputs: 4,
      outputChannelCount: [1, 1, 1, 2],
      channelCount: 1,
      channelCountMode: "explicit",
    });
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      if (this.disposed) return;
      const data = event.data;
      this.input.acceptMeter(data);
      this.loop.accept(data);
      if (isTransportSnapshot(data)) {
        this.loop.acceptTransport(data);
        this.callbacks.onTransportStateChange(data);
        return;
      }
      if (typeof data !== "object" || data === null || !("type" in data)) return;
      if (data.type === "playing") this.callbacks.onToneStateChange(true);
      if (data.type === "stopped") this.callbacks.onToneStateChange(false);
      if (data.type === "metronome" && "enabled" in data && typeof data.enabled === "boolean") {
        this.callbacks.onMetronomeStateChange(data.enabled);
      }
    };
    node.onprocessorerror = () => {
      this.input.setAudioRunning(false);
      this.callbacks.onProcessorError();
    };

    const toneGain = this.context.createGain();
    toneGain.gain.value = 0.15;
    const clickGain = this.context.createGain();
    clickGain.gain.value = 0.15;
    this.node = node;
    this.toneGain = toneGain;
    this.clickGain = clickGain;
    this.loopGain = this.context.createGain();
    this.loopGain.gain.value = 1; // Master gain and stereo output metering live in the Worklet.
    node.connect(this.loopGain, 3);
    this.loopGain.connect(this.context.destination);
    node.connect(toneGain, 0);
    node.connect(clickGain, 1);
    toneGain.connect(this.context.destination);
    clickGain.connect(this.context.destination);
    this.input.attachAudio(this.context, node);
    this.loop.attach(this.context, node);
    this.context.addEventListener("statechange", this.handleContextStateChange);
  }

  async resume(): Promise<void> {
    this.assertActive();
    await this.context.resume();
    this.assertActive();
    if (this.context.state !== "running") {
      throw new AudioSetupError("not-running");
    }
    this.input.setAudioRunning(true);
    this.loop.setRunning(true);
    this.callbacks.onContextStateChange("running");
  }

  startTone(): void {
    this.assertActive();
    if (this.context.state !== "running" || !this.node) return;
    this.node.port.postMessage({ type: "start" });
  }

  stopTone(): void {
    if (this.disposed || !this.node) return;
    this.node.port.postMessage({ type: "stop" });
  }

  startTransport(): void {
    if (this.disposed || this.context.state !== "running") return;
    this.node?.port.postMessage({ type: "transport-start" });
  }

  stopTransport(): void {
    if (this.disposed || this.context.state !== "running") return;
    this.loop.stop();
    this.node?.port.postMessage({ type: "transport-stop" });
  }

  resetTransport(): void {
    if (this.disposed || this.context.state !== "running") return;
    this.loop.stop();
    this.node?.port.postMessage({ type: "transport-reset" });
  }

  configureTransport(config: TransportConfig): void {
    if (this.disposed || this.context.state !== "running" || this.loop.locked) return;
    this.node?.port.postMessage({ type: "transport-configure", config });
  }

  setMetronomeEnabled(enabled: boolean): void {
    if (this.disposed || this.context.state !== "running") return;
    this.node?.port.postMessage({ type: "metronome-enable", enabled });
  }

  setMetronomeVolume(volume: number): void {
    if (this.disposed || !this.clickGain || !Number.isFinite(volume) || volume < 0 || volume > 100) return;
    this.clickGain.gain.setTargetAtTime(volume * 0.003, this.context.currentTime, 0.005);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.context.removeEventListener("statechange", this.handleContextStateChange);
    this.loop.detach();
    this.input.detachAudio();
    if (this.node) {
      this.node.onprocessorerror = null;
      this.node.port.onmessage = null;
    }
    this.node?.port.postMessage({ type: "stop" });
    this.node?.port.close();
    this.node?.disconnect();
    this.toneGain?.disconnect();
    this.clickGain?.disconnect();
    this.loopGain?.disconnect();
    this.node = null;
    this.toneGain = null;
    this.clickGain = null;
    this.loopGain = null;
    if (this.context.state !== "closed") await this.context.close();
  }

  private assertActive(): void {
    if (this.disposed) throw new AudioSetupError("disposed");
  }
}
