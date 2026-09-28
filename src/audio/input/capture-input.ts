/** Shared readiness contract for microphone and internal instruments. */
export interface CaptureInput {
  getSnapshot(): { phase: string; routed: boolean };
  subscribe(listener: () => void): () => void;
  setCaptureLocked(locked: boolean): void;
  readonly reservedBytes?: number;
}
