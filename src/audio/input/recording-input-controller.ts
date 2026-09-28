import type { MicrophoneController } from "./microphone-controller";
import { DrumController } from "../instruments/drum-controller";
import { DRUM_MEMORY_BYTES } from "../instruments/drum-kit";
import { PianoController } from "../instruments/piano-controller";
import { PIANO_MEMORY_BYTES } from "../instruments/piano-bank";
import type { CaptureInput } from "./capture-input";

export type RecordingSource = "microphone" | "drums" | "piano";
type Snapshot = { source: RecordingSource; phase: "active" | "idle"; routed: boolean; captureLocked: boolean };
const initial: Snapshot = { source: "microphone", phase: "idle", routed: false, captureLocked: false };

/** Input selection is global: the station permits one capture at a time. */
export class RecordingInputController implements CaptureInput {
  readonly drums = new DrumController();
  readonly piano = new PianoController();
  readonly reservedBytes = DRUM_MEMORY_BYTES + PIANO_MEMORY_BYTES;
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
    this.piano.attach(context, node);
    this.cleanups = [this.microphone.subscribe(() => this.refresh()), this.drums.subscribe(() => this.refresh()), this.piano.subscribe(() => this.refresh())];
    this.refresh();
  }
  detach(): void {
    this.cleanups.forEach((cleanup) => cleanup()); this.cleanups = [];
    this.node = null; this.sent = null;
    this.drums.detach(); this.piano.detach();
    this.update(initial);
  }
  select(source: RecordingSource): void {
    if (this.snapshot.captureLocked || !this.node || source === this.snapshot.source) return;
    this.microphone.setMonitor(false);
    this.drums.setEnabled(false); this.piano.setEnabled(false);
    this.update({ source, routed: false, phase: "idle" });
    if (source !== "piano") this.piano.cancelLoad();
    if (source !== "drums") this.drums.cancelLoad();
    this.refresh();
  }
  setCaptureLocked(captureLocked: boolean): void {
    this.microphone.setCaptureLocked(captureLocked);
    this.piano.setCaptureLocked(captureLocked);
    if (captureLocked !== this.snapshot.captureLocked) this.update({ captureLocked });
  }
  accept(value: unknown): void {
    if (!this.node || !this.sent || typeof value !== "object" || value === null || !("type" in value) || value.type !== "capture-route-applied"
      || !("revision" in value) || value.revision !== this.revision) return;
    const ready = this.sent.active;
    this.drums.setEnabled(ready && this.snapshot.source === "drums");
    this.piano.setEnabled(ready && this.snapshot.source === "piano");
    this.update({ routed: ready, phase: ready ? "active" : "idle" });
  }
  setRunning(running: boolean): void { this.drums.setRunning(running); this.piano.setRunning(running); }
  stopAll(): void { this.drums.stopAll(); this.piano.stopAll(); }
  private refresh(): void {
    const mic = this.microphone.getSnapshot();
    const drums = this.drums.getSnapshot();
    const piano = this.piano.getSnapshot();
    const source = this.snapshot.source;
    const active = source === "piano" ? piano.phase === "ready" && piano.running : source === "drums" ? drums.phase === "ready" && drums.running : mic.phase === "active" && mic.routed && mic.audioReady;
    if (!this.node || (this.sent?.source === source && this.sent.active === active)) return;
    this.sent = { source, active };
    this.drums.setEnabled(false); this.piano.setEnabled(false);
    this.update({ routed: false, phase: "idle" });
    this.node.port.postMessage({ type: "capture-route", revision: ++this.revision, source, active });
  }
  private update(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
