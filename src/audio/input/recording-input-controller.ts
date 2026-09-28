import type { MicrophoneController } from "./microphone-controller";
import { DrumController } from "../instruments/drum-controller";
import { DRUM_MEMORY_BYTES } from "../instruments/drum-kit";
import { MelodicController } from "../instruments/melodic-controller";
import { MELODIC_MEMORY_BYTES } from "../instruments/melodic-bank";
import type { CaptureInput } from "./capture-input";

export type RecordingSource = "microphone" | "drums" | "piano" | "guitar";
type Snapshot = { source: RecordingSource; phase: "active" | "idle"; routed: boolean; captureLocked: boolean };
const initial: Snapshot = { source: "microphone", phase: "idle", routed: false, captureLocked: false };

/** Input selection is global: the station permits one capture at a time. */
export class RecordingInputController implements CaptureInput {
  readonly drums = new DrumController();
  readonly melodic = new MelodicController();
  readonly reservedBytes = DRUM_MEMORY_BYTES + MELODIC_MEMORY_BYTES;
  private snapshot = initial;
  private listeners = new Set<() => void>();
  private node: AudioWorkletNode | null = null;
  private cleanups: (() => void)[] = [];
  private revision = 0;
  private sent: { source: RecordingSource; active: boolean } | null = null;
  constructor(private readonly microphone: MicrophoneController) {}
  readonly getSnapshot = () => this.snapshot;
  readonly getServerSnapshot = () => initial;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  attach(context: AudioContext, node: AudioWorkletNode): void {
    this.node = node;
    this.sent = null;
    this.drums.attach(context, node);
    this.melodic.attach(context, node);
    this.cleanups = [this.microphone.subscribe(() => this.refresh()), this.drums.subscribe(() => this.refresh()), this.melodic.subscribe(() => this.refresh())];
    this.refresh();
  }
  detach(): void {
    this.cleanups.forEach((cleanup) => cleanup()); this.cleanups = [];
    this.node = null; this.sent = null;
    this.drums.detach(); this.melodic.detach();
    this.update(initial);
  }
  select(source: RecordingSource): void {
    if (this.snapshot.captureLocked || !this.node || source === this.snapshot.source) return;
    this.microphone.setMonitor(false);
    this.drums.setEnabled(false); this.melodic.setEnabled(false);
    this.update({ source, routed: false, phase: "idle" });
    if (source === "piano" || source === "guitar") this.melodic.selectInstrument(source);
    else this.melodic.unload();
    if (source !== "drums") this.drums.cancelLoad();
    this.refresh();
  }
  setCaptureLocked(captureLocked: boolean): void {
    this.microphone.setCaptureLocked(captureLocked);
    this.melodic.setCaptureLocked(captureLocked);
    if (captureLocked !== this.snapshot.captureLocked) this.update({ captureLocked });
  }
  accept(value: unknown): void {
    if (!this.node || !this.sent || typeof value !== "object" || value === null || !("type" in value) || value.type !== "capture-route-applied"
      || !("revision" in value) || value.revision !== this.revision) return;
    const ready = this.sent.active;
    this.drums.setEnabled(ready && this.snapshot.source === "drums");
    this.melodic.setEnabled(ready && this.snapshot.source === this.melodic.getSnapshot().instrument);
    this.update({ routed: ready, phase: ready ? "active" : "idle" });
  }
  setRunning(running: boolean): void { this.drums.setRunning(running); this.melodic.setRunning(running); }
  stopAll(): void { this.drums.stopAll(); this.melodic.stopAll(); }
  private refresh(): void {
    const mic = this.microphone.getSnapshot();
    const drums = this.drums.getSnapshot();
    const melodic = this.melodic.getSnapshot();
    const source = this.snapshot.source;
    const active = source === "piano" || source === "guitar" ? melodic.instrument === source && melodic.phase === "ready" && melodic.running : source === "drums" ? drums.phase === "ready" && drums.running : mic.phase === "active" && mic.routed && mic.audioReady;
    if (!this.node || (this.sent?.source === source && this.sent.active === active)) return;
    this.sent = { source, active };
    this.drums.setEnabled(false); this.melodic.setEnabled(false);
    this.update({ routed: false, phase: "idle" });
    this.node.port.postMessage({ type: "capture-route", revision: ++this.revision, source, active });
  }
  private update(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
