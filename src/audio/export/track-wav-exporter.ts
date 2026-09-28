import type { StationController } from "../loop/station-controller";
import { checkWavMemory, wavFilename } from "./wav";

type Snapshot = { phase: "idle" | "encoding" | "ready" | "error"; progress: number; url: string | null; filename: string; issue: string | null; clipped: number };
const initial: Snapshot = { phase: "idle", progress: 0, url: null, filename: "", issue: null, clipped: 0 };
export class TrackWavExporter {
  private snapshot = initial;
  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private locked = false;
  constructor(private readonly station: StationController) {}
  readonly getSnapshot = () => this.snapshot;
  readonly getServerSnapshot = () => initial;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  start(trackId: number, title: string): void {
    if (this.snapshot.phase === "encoding" || this.snapshot.phase === "ready") return;
    try {
      const reason = this.station.projectChangeReason;
      if (reason) throw new Error(reason);
      const take = this.station.tracks[trackId]?.historyState.current;
      if (!take) throw new Error("이 트랙에 녹음된 루프가 없습니다.");
      const size = checkWavMemory(take, this.station.retainedBytes);
      if (!this.station.beginFileExport()) throw new Error("현재 작업이 끝난 뒤 다시 시도하세요.");
      this.locked = true;
      this.update({ ...initial, phase: "encoding", filename: wavFilename(title, trackId, take.metadata.sampleRate) });
      const worker = new Worker(new URL("./wav-worker.ts", import.meta.url));
      this.worker = worker;
      this.timeout = setTimeout(() => { if (this.worker === worker) this.fail("WAV 준비 시간이 초과되었습니다. 다시 시도하세요."); }, 30000);
      worker.onerror = (event) => { event.preventDefault(); if (this.worker === worker) this.fail("WAV 작업을 시작하지 못했습니다. 다시 시도하세요."); };
      worker.onmessageerror = () => { if (this.worker === worker) this.fail("WAV 결과를 읽지 못했습니다. 다시 시도하세요."); };
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (this.worker !== worker) return;
        try {
          const value = event.data;
          if (typeof value !== "object" || value === null || !("type" in value)) throw new Error("WAV 응답이 올바르지 않습니다.");
          if (value.type === "progress" && "progress" in value && typeof value.progress === "number" && Number.isFinite(value.progress)) {
            this.update({ progress: Math.max(0, Math.min(1, value.progress)) }); return;
          }
          if (value.type === "error" && "issue" in value && typeof value.issue === "string") throw new Error(value.issue);
          if (value.type !== "ready" || !("wav" in value) || !(value.wav instanceof ArrayBuffer) || value.wav.byteLength !== size
            || !("clipped" in value) || typeof value.clipped !== "number" || !Number.isSafeInteger(value.clipped) || value.clipped < 0 || value.clipped > take.metadata.frames) throw new Error("WAV 결과가 올바르지 않습니다.");
          this.stopWorker();
          const url = URL.createObjectURL(new Blob([value.wav], { type: "audio/wav" }));
          this.update({ phase: "ready", progress: 1, url, clipped: value.clipped });
        } catch (error) { this.fail(error instanceof Error ? error.message : "WAV 파일 준비에 실패했습니다."); }
      };
      // Structured-clone the input. Never transfer/detach the original history PCM.
      worker.postMessage(take);
    } catch (error) { this.fail(error instanceof Error ? error.message : "WAV 파일 준비에 실패했습니다."); }
  }
  cancel(): void { this.release(); this.update(initial); }
  private stopWorker(): void {
    this.worker?.terminate(); this.worker = null;
    if (this.timeout !== null) clearTimeout(this.timeout); this.timeout = null;
  }
  private release(): void {
    this.stopWorker();
    if (this.snapshot.url) URL.revokeObjectURL(this.snapshot.url);
    if (this.locked) { this.locked = false; this.station.endFileExport(); }
  }
  private fail(issue: string): void { this.release(); this.update({ ...initial, phase: "error", issue }); }
  private update(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener();
  }
}
