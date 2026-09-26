import { isTransportSnapshot, type TransportConfig, type TransportSnapshot } from "../transport/audio-frame-clock";
import type { MicrophoneController } from "../input/microphone-controller";
import type { StationController } from "../loop/station-controller";
import { AUDIO_STARTUP_TIMEOUT_MS, isWorkletReady } from "./worklet-protocol";

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
  | "worklet-protocol-mismatch"
  | "startup-timeout"
  | "processor-failed"
  | "disposed";

export class AudioSetupError extends Error {
  constructor(readonly code: AudioSetupErrorCode) {
    super(code);
    this.name = "AudioSetupError";
  }
}

/** Main-thread failure detection only; never used as a transport or loop clock. */
function startupDeadline(work: Promise<void>, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", cancelled); };
    const cancelled = () => { cleanup(); reject(new AudioSetupError("disposed")); };
    const timer = setTimeout(() => { cleanup(); reject(new AudioSetupError("startup-timeout")); }, AUDIO_STARTUP_TIMEOUT_MS);
    signal.addEventListener("abort", cancelled, { once: true });
    work.then(() => { cleanup(); resolve(); }, (error: unknown) => { cleanup(); reject(error); });
    if (signal.aborted) cancelled();
  });
}

export class TestToneEngine {
  private readonly context: AudioContext;
  private node: AudioWorkletNode | null = null;
  private toneGain: GainNode | null = null;
  private clickGain: GainNode | null = null;
  private loopGain: GainNode | null = null;
  private disposed = false;
  private ready = false;
  private initialization: Promise<void> | null = null;
  private disposal: Promise<void> | null = null;
  private readonly startupAbort = new AbortController();
  private readyWaiter: { resolve(): void; reject(error: AudioSetupError): void } | null = null;

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
    return this.ready && !this.disposed;
  }

  initialize(): Promise<void> {
    if (this.disposed) return Promise.reject(new AudioSetupError("disposed"));
    this.initialization ??= this.initializeOnce();
    return this.initialization;
  }

  private async initializeOnce(): Promise<void> {
    try { await startupDeadline(this.prepareGraph(), this.startupAbort.signal); }
    catch (error) {
      await this.dispose();
      throw error;
    }
  }

  private async prepareGraph(): Promise<void> {
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
    this.node = node;
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      if (this.disposed) return;
      const data = event.data;
      if (typeof data === "object" && data !== null && "type" in data && data.type === "worklet-ready") {
        if (isWorkletReady(data, this.sampleRate)) this.readyWaiter?.resolve();
        else this.readyWaiter?.reject(new AudioSetupError("worklet-protocol-mismatch"));
        return;
      }
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
      if (this.disposed) return;
      if (!this.ready) {
        this.readyWaiter?.reject(new AudioSetupError("processor-failed"));
        return;
      }
      this.input.setAudioRunning(false);
      this.callbacks.onProcessorError();
    };

    const toneGain = this.context.createGain();
    toneGain.gain.value = 0.15;
    const clickGain = this.context.createGain();
    clickGain.gain.value = 0.15;
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
    // Connecting a node is not evidence that its process() has rendered a block.
    await new Promise<void>((resolve, reject) => { this.readyWaiter = { resolve, reject }; });
    this.readyWaiter = null;
    this.assertActive();
    if (this.context.state !== "running") throw new AudioSetupError("not-running");
    this.input.attachAudio(this.context, node);
    this.loop.attach(this.context, node);
    this.context.addEventListener("statechange", this.handleContextStateChange);
    this.ready = true;
  }

  async resume(): Promise<void> {
    this.assertActive();
    if (!this.ready) throw new AudioSetupError("not-running");
    await startupDeadline(this.context.resume(), this.startupAbort.signal);
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
    if (!this.isReady || this.context.state !== "running" || !this.node) return;
    this.node.port.postMessage({ type: "start" });
  }

  stopTone(): void {
    if (this.disposed || !this.node) return;
    this.node.port.postMessage({ type: "stop" });
  }

  startTransport(): void {
    if (!this.isReady || this.context.state !== "running") return;
    this.node?.port.postMessage({ type: "transport-start" });
  }

  stopTransport(): void {
    if (!this.isReady || this.context.state !== "running") return;
    this.loop.stop();
    this.node?.port.postMessage({ type: "transport-stop" });
  }

  resetTransport(): void {
    if (!this.isReady || this.context.state !== "running") return;
    this.loop.stop();
    this.node?.port.postMessage({ type: "transport-reset" });
  }

  configureTransport(config: TransportConfig): void {
    if (!this.isReady || this.context.state !== "running" || this.loop.locked) return;
    this.node?.port.postMessage({ type: "transport-configure", config });
  }

  setMetronomeEnabled(enabled: boolean): void {
    if (!this.isReady || this.context.state !== "running") return;
    this.node?.port.postMessage({ type: "metronome-enable", enabled });
  }

  setMetronomeVolume(volume: number): void {
    if (this.disposed || !this.clickGain || !Number.isFinite(volume) || volume < 0 || volume > 100) return;
    this.clickGain.gain.setTargetAtTime(volume * 0.003, this.context.currentTime, 0.005);
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    // Keep one close promise until the browser has actually released the context.
    this.disposal = this.closeContext().catch((error: unknown) => {
      this.disposal = null;
      throw error;
    });
    return this.disposal;
  }

  private async closeContext(): Promise<void> {
    try { if (!this.disposed) this.releaseGraph(); }
    finally { if (this.context.state !== "closed") await this.context.close(); }
  }

  private releaseGraph(): void {
    this.disposed = true;
    this.ready = false;
    this.startupAbort.abort();
    this.readyWaiter?.reject(new AudioSetupError("disposed"));
    this.readyWaiter = null;
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
  }

  private assertActive(): void {
    if (this.disposed) throw new AudioSetupError("disposed");
  }
}
