import type { CachedLoop, LoopHistoryState } from "../loop/loop-history";
import { isLoopMetadata, isRecordBars, loopBars, LOOP_MEMORY_BYTES, recordingCapacity } from "../loop/loop-protocol";

export type SavedLoopSession = {
  schemaVersion: 1;
  revision: string;
  updatedAt: number;
  history: LoopHistoryState;
  checksum: string;
};
export class LoopStorageError extends Error {
  constructor(readonly code: "unavailable" | "blocked" | "corrupt" | "version" | "conflict", message: string) { super(message); }
}
export type StoredSession<State> = { revision: string; updatedAt: number; history: State };
export interface SessionRepository<State> {
  load(): Promise<StoredSession<State> | null>;
  save(history: State, expectedRevision: string | null): Promise<StoredSession<State>>;
}
export interface LoopRepository extends SessionRepository<LoopHistoryState> {
  load(): Promise<SavedLoopSession | null>;
  save(history: LoopHistoryState, expectedRevision: string | null): Promise<SavedLoopSession>;
}

function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function validTake(value: unknown): value is CachedLoop | null {
  if (value === null) return true;
  if (!object(value) || !isLoopMetadata(value.metadata) || !(value.pcm instanceof ArrayBuffer)) return false;
  const meta = value.metadata;
  const bars = loopBars(meta);
  if (!isRecordBars(bars)) return false;
  const capacity = recordingCapacity(meta.sampleRate, meta, bars);
  const expectedFrames = capacity - 1;
  return value.pcm.byteLength === capacity * 4 && meta.frames <= capacity
    && (!meta.complete || Math.abs(meta.frames - expectedFrames) <= 1);
}
function validRevisions(value: Record<string, unknown>): boolean {
  if (!validTake(value.current) || !validTake(value.undo) || !validTake(value.redo) || (value.undo && value.redo)) return false;
  if (!value.current?.metadata.complete) return value.undo === null && value.redo === null;
  const current = value.current.metadata;
  return [value.undo, value.redo].every((take) => take === null || (take.metadata.complete
    && take.metadata.bpm === current.bpm && take.metadata.numerator === current.numerator
    && take.metadata.denominator === current.denominator && take.metadata.sampleRate === current.sampleRate && take.metadata.ticks === current.ticks));
}
export function sessionTakes(history: LoopHistoryState): (CachedLoop | null)[] {
  return [history.current, history.undo, history.redo,
    history.cleared?.current ?? null, history.cleared?.undo ?? null, history.cleared?.redo ?? null];
}
export function isLoopHistoryState(value: unknown): value is LoopHistoryState {
  if (!object(value) || !validRevisions(value)) return false;
  if (value.cleared !== null && (!object(value.cleared) || !validRevisions(value.cleared) || !value.cleared.current)) return false;
  if (object(value.current) && object(value.current.metadata) && value.current.metadata.complete && value.cleared !== null) return false;
  // The shape above is narrowed field by field; avoid copying any PCM here.
  const history = value as LoopHistoryState;
  const buffers = new Set(sessionTakes(history).flatMap((take) => take ? [take.pcm] : []));
  let bytes = 0;
  for (const buffer of buffers) bytes += buffer.byteLength;
  return bytes * 2 + (history.current?.pcm.byteLength ?? 0) <= LOOP_MEMORY_BYTES;
}
export async function digest(buffer: ArrayBuffer): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function historyChecksum(history: LoopHistoryState): Promise<string> {
  // At most six slots; hash shared buffers only once. Validation reserves a full
  // history-sized working copy, and IDB serialization starts after hashing ends.
  const hashes = new Map<ArrayBuffer, Promise<string>>();
  const descriptors = await Promise.all(sessionTakes(history).map(async (take) => {
    if (!take) return null;
    const { bpm, numerator, denominator, sampleRate, frames, ticks, complete } = take.metadata;
    let hash = hashes.get(take.pcm);
    if (!hash) { hash = digest(take.pcm); hashes.set(take.pcm, hash); }
    return { bpm, numerator, denominator, sampleRate, frames, ticks, complete, pcm: await hash };
  }));
  return digest(new TextEncoder().encode(JSON.stringify({ cleared: history.cleared !== null, descriptors })).buffer);
}
export function assertFiniteSamples(history: LoopHistoryState): void {
  const checked = new Set<ArrayBuffer>();
  for (const take of sessionTakes(history)) {
    if (!take || checked.has(take.pcm)) continue;
    checked.add(take.pcm);
    if (!new Float32Array(take.pcm).every(Number.isFinite)) throw new LoopStorageError("corrupt", "오디오에 비정상 샘플이 있습니다. 저장하거나 재생하지 않습니다.");
  }
}
export async function createLoopSession(history: LoopHistoryState): Promise<SavedLoopSession> {
  if (!isLoopHistoryState(history)) throw new LoopStorageError("corrupt", "저장할 루프 정보나 메모리 한도를 확인하지 못했습니다.");
  assertFiniteSamples(history);
  return { schemaVersion: 1, revision: crypto.randomUUID(), updatedAt: Date.now(), history, checksum: await historyChecksum(history) };
}
export async function decodeLoopSession(value: unknown): Promise<SavedLoopSession> {
  if (object(value) && typeof value.schemaVersion === "number" && value.schemaVersion > 1) {
    throw new LoopStorageError("version", "더 새로운 앱에서 저장한 루프입니다. 저장본을 변경하지 않았습니다.");
  }
  if (!object(value) || value.schemaVersion !== 1 || typeof value.revision !== "string" || value.revision.length > 64 || !value.revision
    || typeof value.updatedAt !== "number" || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0
    || typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/.test(value.checksum) || !isLoopHistoryState(value.history)) {
    throw new LoopStorageError("corrupt", "저장된 루프 형식을 읽을 수 없습니다. 저장본은 그대로 남겨두었습니다.");
  }
  if (await historyChecksum(value.history) !== value.checksum) throw new LoopStorageError("corrupt", "저장된 루프의 무결성 확인에 실패했습니다. 저장본은 변경하지 않았습니다.");
  assertFiniteSamples(value.history);
  return { schemaVersion: 1, revision: value.revision, updatedAt: value.updatedAt, checksum: value.checksum, history: value.history };
}
