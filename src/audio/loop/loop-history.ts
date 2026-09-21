import type { CaptureMode, LoopMetadata } from "./loop-protocol";

export type CachedLoop = { pcm: ArrayBuffer; metadata: LoopMetadata };
export type HistoryDirection = "undo" | "redo";
type Revisions = { current: CachedLoop; undo: CachedLoop | null; redo: CachedLoop | null };

/** One reversible overdub session; immutable PCM stays outside React state. */
export class LoopHistory {
  current: CachedLoop | null = null;
  private undoRevision: CachedLoop | null = null;
  private redoRevision: CachedLoop | null = null;
  private cleared: Revisions | null = null;

  get canUndo(): boolean { return this.undoRevision !== null; }
  get canRedo(): boolean { return this.redoRevision !== null; }
  get canRestore(): boolean { return this.cleared !== null && !this.current?.metadata.complete; }
  get dirty(): boolean { return this.current !== null || this.cleared !== null; }
  get retainedBytes(): number {
    const buffers = new Set([this.current, this.undoRevision, this.redoRevision,
      this.cleared?.current, this.cleared?.undo, this.cleared?.redo].flatMap((revision) => revision ? [revision.pcm] : []));
    let bytes = 0;
    for (const buffer of buffers) bytes += buffer.byteLength;
    return bytes;
  }

  commit(take: CachedLoop, mode: CaptureMode): void {
    if (mode === "overdub") {
      if (!take.metadata.complete || !this.current?.metadata.complete) return;
      this.undoRevision = this.current;
      this.redoRevision = null;
    } else {
      this.undoRevision = null;
      this.redoRevision = null;
    }
    this.current = take;
    if (take.metadata.complete) this.cleared = null;
  }

  target(direction: HistoryDirection): CachedLoop | null {
    return direction === "undo" ? this.undoRevision : this.redoRevision;
  }

  apply(direction: HistoryDirection, target: CachedLoop): boolean {
    if (!this.current || this.target(direction) !== target) return false;
    if (direction === "undo") {
      this.redoRevision = this.current;
      this.undoRevision = null;
    } else {
      this.undoRevision = this.current;
      this.redoRevision = null;
    }
    this.current = target;
    return true;
  }

  clear(): void {
    if (!this.current) return;
    if (this.current.metadata.complete || !this.cleared) {
      this.cleared = { current: this.current, undo: this.undoRevision, redo: this.redoRevision };
    }
    this.current = null;
    this.undoRevision = null;
    this.redoRevision = null;
  }

  restore(): boolean {
    if (!this.canRestore || !this.cleared) return false;
    this.current = this.cleared.current;
    this.undoRevision = this.cleared.undo;
    this.redoRevision = this.cleared.redo;
    this.cleared = null;
    return true;
  }
}
