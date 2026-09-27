import { isTransportConfig, type TransportConfig } from "../transport/audio-frame-clock";
import { defaultMasterMix, defaultStationMix, isLegacyTrackMix, isMasterMix, isStationMix, type LegacyTrackMix, type MasterMix, type StationMix } from "../loop/track-mixer";
import type { LoopHistoryState } from "../loop/loop-history";
import { STATION_MEMORY_BYTES, TRACK_COUNT, sameTempo } from "../loop/station-protocol";
import { IndexedDbSessionRepository } from "./indexed-db-loop-repository";
import { assertFiniteSamples, decodeLoopSession, digest, historyChecksum, isLoopHistoryState, LoopStorageError, sessionTakes } from "./loop-session";

export type StationHistory = LoopHistoryState[];
export type StationProject = { tracks: StationHistory; mixer: StationMix; master: MasterMix; transport?: TransportConfig };
export type SavedStationSession = {
  schemaVersion: 6; revision: string; updatedAt: number; history: StationProject; checksum: string;
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
async function legacyChecksum(history: StationHistory): Promise<string> {
  const hashes = await Promise.all(history.map(historyChecksum));
  return digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 2, tracks: hashes })).buffer);
}
function validProject(value: unknown): value is StationProject {
  return typeof value === "object" && value !== null && "tracks" in value && validHistory(value.tracks)
    && "mixer" in value && isStationMix(value.mixer) && "master" in value && isMasterMix(value.master);
}
function validLegacyProject(value: unknown): value is { tracks: StationHistory; mixer: readonly LegacyTrackMix[] } {
  return typeof value === "object" && value !== null && "tracks" in value && validHistory(value.tracks)
    && "mixer" in value && Array.isArray(value.mixer) && value.mixer.length === TRACK_COUNT && Array.from(value.mixer).every(isLegacyTrackMix);
}
async function checksum(project: StationProject, schemaVersion = 6): Promise<string> {
  const hashes = await Promise.all(project.tracks.map(historyChecksum));
  const mixer = project.mixer.map(({ gainDb, mute, solo, pan }) => ({ gainDb, mute, solo, pan }));
  return digest(new TextEncoder().encode(JSON.stringify({ schemaVersion, tracks: hashes, mixer, master: { gainDb: project.master.gainDb, mute: project.master.mute }, ...(schemaVersion >= 6 ? { transport: projectTransport(project) } : {}) })).buffer);
}
export function projectTransport(project: StationProject): TransportConfig {
  const take = project.tracks.flatMap(sessionTakes).find((value) => value !== null);
  const config = project.transport ?? take?.metadata ?? { bpm: 120, numerator: 4, denominator: 4 };
  return { bpm: config.bpm, numerator: config.numerator, denominator: config.denominator };
}
function validTransport(project: StationProject): boolean {
  const config = projectTransport(project);
  return isTransportConfig(config) && project.tracks.flatMap(sessionTakes).every((take) => !take || sameTempo(take.metadata, config));
}
export async function createStationSession(history: StationProject): Promise<SavedStationSession> {
  if (!validProject(history) || !validTransport(history)) throw new LoopStorageError("corrupt", "트랙의 공통 박자, 믹서 설정이나 프로젝트 메모리 한도를 확인하지 못했습니다. 이전 저장본은 유지됩니다.");
  history.tracks.forEach(assertFiniteSamples);
  history = { ...history, transport: projectTransport(history) };
  return { schemaVersion: 6, revision: crypto.randomUUID(), updatedAt: Date.now(), history, checksum: await checksum(history) };
}
export async function decodeStationSession(value: unknown): Promise<SavedStationSession> {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) throw new LoopStorageError("corrupt", "저장된 프로젝트 형식을 읽을 수 없습니다.");
  if (value.schemaVersion === 1) {
    const legacy = await decodeLoopSession(value);
    const tracks = emptyStationHistory();
    tracks[0] = legacy.history;
    if (!validHistory(tracks)) throw new LoopStorageError("corrupt", "이전 루프와 복구 이력의 박자가 서로 달라 프로젝트로 불러올 수 없습니다. 원본은 변경하지 않았습니다.");
    const base = { tracks, mixer: defaultStationMix(), master: defaultMasterMix() };
    const history = { ...base, transport: projectTransport(base) };
    // Read-only migration. Opening the app never rewrites the original session.
    return { schemaVersion: 6, revision: legacy.revision, updatedAt: legacy.updatedAt, history, checksum: await checksum(history) };
  }
  if (typeof value.schemaVersion === "number" && value.schemaVersion > 6) throw new LoopStorageError("version", "더 새로운 앱에서 저장한 프로젝트입니다. 저장본은 변경하지 않았습니다.");
  if ((value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== 4 && value.schemaVersion !== 5 && value.schemaVersion !== 6) || !("history" in value)
    || !("revision" in value) || typeof value.revision !== "string" || !value.revision || value.revision.length > 64
    || !("updatedAt" in value) || typeof value.updatedAt !== "number" || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0
    || !("checksum" in value) || typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/.test(value.checksum)) throw new LoopStorageError("corrupt", "저장된 트랙 정보를 읽을 수 없습니다. 저장본은 그대로 남겨두었습니다.");
  let history: StationProject;
  let actualChecksum: string;
  if (value.schemaVersion === 2 && validHistory(value.history)) {
    actualChecksum = await legacyChecksum(value.history);
    history = { tracks: value.history, mixer: defaultStationMix(), master: defaultMasterMix() };
  } else if (value.schemaVersion === 3 && validLegacyProject(value.history)) {
    const legacy = value.history;
    const hashes = await Promise.all(legacy.tracks.map(historyChecksum));
    const mixer = legacy.mixer.map(({ gainDb, mute, solo }) => ({ gainDb, mute, solo }));
    actualChecksum = await digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 3, tracks: hashes, mixer })).buffer);
    history = { tracks: legacy.tracks, mixer: mixer.map((track) => ({ ...track, pan: 0 })), master: defaultMasterMix() };
  } else if ((value.schemaVersion === 4 || value.schemaVersion === 5 || value.schemaVersion === 6) && validProject(value.history)) {
    history = value.schemaVersion === 6 ? value.history : { tracks: value.history.tracks, mixer: value.history.mixer, master: value.history.master };
    if (value.schemaVersion === 6 && (!isTransportConfig(history.transport) || !validTransport(history))) throw new LoopStorageError("corrupt", "프로젝트 템포와 루프가 일치하지 않습니다.");
    actualChecksum = await checksum(history, value.schemaVersion);
  } else {
    throw new LoopStorageError("corrupt", "저장된 트랙이나 믹서 설정을 읽을 수 없습니다. 저장본은 변경하지 않았습니다.");
  }
  if (actualChecksum !== value.checksum) throw new LoopStorageError("corrupt", "프로젝트 무결성 확인에 실패했습니다. 저장본은 변경하지 않았습니다.");
  history.tracks.forEach(assertFiniteSamples);
  history = { ...history, transport: projectTransport(history) };
  return { schemaVersion: 6, revision: value.revision, updatedAt: value.updatedAt, history,
    checksum: value.schemaVersion !== 6 ? await checksum(history) : actualChecksum };
}
export class IndexedDbStationRepository extends IndexedDbSessionRepository<StationProject, SavedStationSession> {
  constructor() { super({ create: createStationSession, decode: decodeStationSession }); }
}
