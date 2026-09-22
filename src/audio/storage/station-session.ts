import type { LoopHistoryState } from "../loop/loop-history";
import { STATION_MEMORY_BYTES, TRACK_COUNT, sameTempo } from "../loop/station-protocol";
import { IndexedDbSessionRepository } from "./indexed-db-loop-repository";
import { assertFiniteSamples, decodeLoopSession, digest, historyChecksum, isLoopHistoryState, LoopStorageError, sessionTakes } from "./loop-session";

export type StationHistory = LoopHistoryState[];
export type SavedStationSession = {
  schemaVersion: 2; revision: string; updatedAt: number; history: StationHistory; checksum: string;
};
export function emptyStationHistory(): StationHistory {
  return Array.from({ length: TRACK_COUNT }, () => ({ current: null, undo: null, redo: null, cleared: null }));
}
function validHistory(value: unknown): value is StationHistory {
  if (!Array.isArray(value) || value.length !== TRACK_COUNT || !Array.from(value).every(isLoopHistoryState)) return false;
  const takes = value.flatMap(sessionTakes).filter((take) => take !== null);
  const config = takes[0]?.metadata;
  if (config && takes.some(({ metadata }) => !sameTempo(config, metadata) || config.sampleRate !== metadata.sampleRate)) return false;
  let bytes = 0;
  for (const track of value) {
    // Each track receives its own Worklet copy, even if imported slots alias PCM.
    const buffers = new Set(sessionTakes(track).flatMap((take) => take ? [take.pcm] : []));
    for (const buffer of buffers) bytes += buffer.byteLength;
  }
  // Main-thread history + Worklet playback + hash/IDB serialization copies.
  return bytes * 3 <= STATION_MEMORY_BYTES;
}
async function checksum(history: StationHistory): Promise<string> {
  const hashes = await Promise.all(history.map(historyChecksum));
  return digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 2, tracks: hashes })).buffer);
}
export async function createStationSession(history: StationHistory): Promise<SavedStationSession> {
  if (!validHistory(history)) throw new LoopStorageError("corrupt", "트랙의 공통 박자나 프로젝트 메모리 한도를 확인하지 못했습니다. 이전 저장본은 유지됩니다.");
  history.forEach(assertFiniteSamples);
  return { schemaVersion: 2, revision: crypto.randomUUID(), updatedAt: Date.now(), history, checksum: await checksum(history) };
}
export async function decodeStationSession(value: unknown): Promise<SavedStationSession> {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) throw new LoopStorageError("corrupt", "저장된 프로젝트 형식을 읽을 수 없습니다.");
  if (value.schemaVersion === 1) {
    const legacy = await decodeLoopSession(value);
    const history = emptyStationHistory();
    history[0] = legacy.history;
    if (!validHistory(history)) throw new LoopStorageError("corrupt", "이전 루프와 복구 이력의 박자가 서로 달라 프로젝트로 불러올 수 없습니다. 원본은 변경하지 않았습니다.");
    // Read-only migration. Keep the legacy revision for the next atomic CAS;
    // opening the app alone never rewrites the original saved session.
    return { schemaVersion: 2, revision: legacy.revision, updatedAt: legacy.updatedAt, history, checksum: await checksum(history) };
  }
  if (typeof value.schemaVersion === "number" && value.schemaVersion > 2) throw new LoopStorageError("version", "더 새로운 앱에서 저장한 프로젝트입니다. 저장본은 변경하지 않았습니다.");
  if (value.schemaVersion !== 2 || !("history" in value) || !validHistory(value.history)
    || !("revision" in value) || typeof value.revision !== "string" || !value.revision || value.revision.length > 64
    || !("updatedAt" in value) || typeof value.updatedAt !== "number" || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0
    || !("checksum" in value) || typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/.test(value.checksum)) throw new LoopStorageError("corrupt", "저장된 트랙 정보를 읽을 수 없습니다. 저장본은 그대로 남겨두었습니다.");
  if (await checksum(value.history) !== value.checksum) throw new LoopStorageError("corrupt", "프로젝트 무결성 확인에 실패했습니다. 저장본은 변경하지 않았습니다.");
  value.history.forEach(assertFiniteSamples);
  return { schemaVersion: 2, revision: value.revision, updatedAt: value.updatedAt, history: value.history, checksum: value.checksum };
}
export class IndexedDbStationRepository extends IndexedDbSessionRepository<StationHistory, SavedStationSession> {
  constructor() { super({ create: createStationSession, decode: decodeStationSession }); }
}
