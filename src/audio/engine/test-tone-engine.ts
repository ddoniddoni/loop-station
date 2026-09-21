import { isTransportSnapshot, type TransportConfig, type TransportSnapshot } from "../transport/audio-frame-clock";

type EngineCallbacks = {
  onContextStateChange: (state: AudioContextState) => void;
  onToneStateChange: (playing: boolean) => void;
  onTransportStateChange: (snapshot: TransportSnapshot) => void;
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
  private outputGain: GainNode | null = null;
  private disposed = false;

  private readonly handleContextStateChange = () => {
    if (this.disposed) return;
    if (this.context.state !== "running") this.stopTone();
    this.callbacks.onContextStateChange(this.context.state);
  };

  constructor(private readonly callbacks: EngineCallbacks) {
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
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      if (this.disposed) return;
      const data = event.data;
      if (isTransportSnapshot(data)) {
        this.callbacks.onTransportStateChange(data);
        return;
      }
      if (typeof data !== "object" || data === null || !("type" in data)) return;
      if (data.type === "playing") this.callbacks.onToneStateChange(true);
      if (data.type === "stopped") this.callbacks.onToneStateChange(false);
    };
    node.onprocessorerror = () => this.callbacks.onProcessorError();

    const outputGain = this.context.createGain();
    outputGain.gain.value = 0.15;
    this.node = node;
    this.outputGain = outputGain;
    node.connect(outputGain);
    outputGain.connect(this.context.destination);
    this.context.addEventListener("statechange", this.handleContextStateChange);
  }

  async resume(): Promise<void> {
    this.assertActive();
    await this.context.resume();
    this.assertActive();
    if (this.context.state !== "running") {
      throw new AudioSetupError("not-running");
    }
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
    this.node?.port.postMessage({ type: "transport-stop" });
  }

  resetTransport(): void {
    if (this.disposed || this.context.state !== "running") return;
    this.node?.port.postMessage({ type: "transport-reset" });
  }

  configureTransport(config: TransportConfig): void {
    if (this.disposed || this.context.state !== "running") return;
    this.node?.port.postMessage({ type: "transport-configure", config });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.context.removeEventListener("statechange", this.handleContextStateChange);
    if (this.node) {
      this.node.onprocessorerror = null;
      this.node.port.onmessage = null;
    }
    this.node?.port.postMessage({ type: "stop" });
    this.node?.port.close();
    this.node?.disconnect();
    this.outputGain?.disconnect();
    this.node = null;
    this.outputGain = null;
    if (this.context.state !== "closed") await this.context.close();
  }

  private assertActive(): void {
    if (this.disposed) throw new AudioSetupError("disposed");
  }
}
