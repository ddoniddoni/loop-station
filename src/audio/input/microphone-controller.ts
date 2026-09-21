import { isInputMeterSnapshot, type InputMeterSnapshot } from "./input-meter";
import { MicrophoneInputBus } from "./microphone-input-bus";
import { MicrophoneError, MicrophoneSession, type MicrophoneDevice, type MicrophoneErrorCode, type MicrophoneInfo } from "./microphone-session";

export type MicrophonePhase = "idle" | "requesting" | "switching" | "active" | "error" | "disconnected" | "unavailable";

export type MicrophoneSnapshot = {
  phase: MicrophonePhase;
  info: MicrophoneInfo | null;
  devices: MicrophoneDevice[];
  issue: MicrophoneErrorCode | "routing-failed" | null;
  listUnavailable: boolean;
  audioReady: boolean;
  routed: boolean;
  gainDb: number;
  monitorEnabled: boolean;
  monitorVolume: number;
  meter: InputMeterSnapshot | null;
};

const initialSnapshot: MicrophoneSnapshot = {
  phase: "idle", info: null, devices: [], issue: null, listUnavailable: false,
  audioReady: false, routed: false, gainDb: 0, monitorEnabled: false, monitorVolume: 20, meter: null,
};

// Browser objects stay here; React subscribes only to the lightweight snapshot.
export class MicrophoneController {
  private session: MicrophoneSession | null = null;
  private bus: MicrophoneInputBus | null = null;
  private node: AudioWorkletNode | null = null;
  private revision = 0;
  private requestVersion = 0;
  private snapshot = initialSnapshot;
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): MicrophoneSnapshot => this.snapshot;
  readonly getServerSnapshot = (): MicrophoneSnapshot => initialSnapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  attachAudio(context: AudioContext, node: AudioWorkletNode): void {
    this.bus = new MicrophoneInputBus(context, node);
    this.node = node;
    this.bus.setGain(this.snapshot.gainDb);
    this.update({ audioReady: context.state === "running", monitorEnabled: false });
    this.routeInput();
  }

  setAudioRunning(running: boolean): void {
    this.bus?.setMonitor(0, true);
    this.update({ audioReady: running, monitorEnabled: false, meter: null });
    this.resetMeter();
  }

  detachAudio(): void {
    this.release();
    this.bus?.dispose();
    this.bus = null;
    this.node = null;
    this.update({ audioReady: false });
  }

  acceptMeter(value: unknown): void {
    if (!this.snapshot.audioReady || !this.snapshot.routed || !isInputMeterSnapshot(value) || value.revision !== this.revision) return;
    this.update({ meter: value });
  }

  async request(deviceId?: string): Promise<void> {
    const version = ++this.requestVersion;
    this.disableMonitor();
    this.update({ phase: this.session?.active ? "switching" : "requesting", issue: null });
    try {
      const session = this.getSession();
      const info = await session.request(deviceId);
      if (version !== this.requestVersion) return;
      this.update({ phase: "active", info });
      this.routeInput();
    } catch (error) {
      if (version !== this.requestVersion) return;
      const code = error instanceof MicrophoneError ? error.code : "unknown";
      this.update({
        phase: this.session?.active ? "active" : code === "unsupported" || code === "insecure-context" ? "unavailable" : "error",
        issue: code,
      });
    }
  }

  cancelRequest(): void {
    this.requestVersion += 1;
    this.session?.cancelPending();
    this.update({ phase: this.session?.active ? "active" : "idle", issue: this.session?.active ? null : "cancelled" });
  }

  release(): void {
    this.requestVersion += 1;
    this.session?.release();
    this.bus?.disconnectInput();
    this.bus?.setGain(0);
    this.update({ ...initialSnapshot, audioReady: this.snapshot.audioReady });
    this.resetMeter();
  }

  retryRouting(): void {
    this.routeInput();
  }

  setGain(db: number): void {
    if (!Number.isFinite(db) || db < -24 || db > 24 || !this.canControl()) return;
    this.bus?.setGain(db);
    this.update({ gainDb: db });
  }

  setMonitor(enabled: boolean): void {
    if (!enabled) {
      this.bus?.setMonitor(0);
      this.update({ monitorEnabled: false });
    } else if (this.canControl()) {
      this.bus?.setMonitor(this.snapshot.monitorVolume / 100);
      this.update({ monitorEnabled: true });
    }
  }

  setMonitorVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 100 || !this.canControl()) return;
    if (this.snapshot.monitorEnabled) this.bus?.setMonitor(volume / 100);
    this.update({ monitorVolume: volume });
  }

  clearClip(): void {
    if (!this.canControl()) return;
    this.node?.port.postMessage({ type: "input-clear-clip", revision: this.revision });
  }

  dispose(): void {
    this.detachAudio();
    this.session?.dispose();
    this.session = null;
  }

  private canControl(): boolean {
    return this.snapshot.audioReady && this.snapshot.routed && this.snapshot.phase === "active" && this.session?.active === true;
  }

  private getSession(): MicrophoneSession {
    if (this.session) return this.session;
    this.session = new MicrophoneSession({
      onDisconnected: () => {
        this.release();
        this.update({ phase: "disconnected" });
      },
      onDevicesChanged: (devices) => this.update({ devices, listUnavailable: false }),
      onDeviceListError: () => this.update({ devices: [], listUnavailable: true }),
    });
    return this.session;
  }

  private routeInput(): void {
    this.disableMonitor();
    this.bus?.disconnectInput();
    this.update({ routed: false, meter: null });
    const stream = this.session?.activeStream;
    if (stream && this.bus) {
      try {
        this.bus.connect(stream);
        this.update({ routed: true, issue: null });
      } catch {
        this.update({ issue: "routing-failed" });
      }
    }
    this.resetMeter();
  }

  private resetMeter(): void {
    this.revision += 1;
    this.node?.port.postMessage({ type: "input-route", revision: this.revision, active: this.snapshot.routed && this.snapshot.audioReady });
  }

  private disableMonitor(): void {
    this.bus?.setMonitor(0, true);
    this.update({ monitorEnabled: false });
  }

  private update(patch: Partial<MicrophoneSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
