import { defaultMasterMix, defaultStationMix } from "../loop/track-mixer";
import { isTransportConfig, type TransportConfig } from "../transport/audio-frame-clock";
import { openLoopDatabase } from "./loop-database";
import { checkDuplicateCapacity } from "./project-duplication";
import { LoopStorageError, type SessionRepository } from "./loop-session";
import { createStationSession, decodeStationSession, emptyStationHistory, projectTransport, type SavedStationSession, type StationProject } from "./station-session";

export const LEGACY_PROJECT_ID = "track-01-session";
const PREFIX = "project:";
export type ProjectSummary = {
  id: string; title: string; revision: string; audioRevision: string;
  createdAt: number; updatedAt: number; updatedAtLabel: string;
  clipCount: number; transport: TransportConfig;
};
type ProjectRecord = Omit<ProjectSummary, "updatedAtLabel"> & { version: 1 };

export function projectTitle(value: string): string {
  const title = value.trim();
  if (!title || title.length > 80 || /[\u0000-\u001f\u007f]/u.test(title)) throw new Error("프로젝트 이름은 1~80자로 입력하세요.");
  return title;
}
export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && (value === LEGACY_PROJECT_ID || /^loop-[0-9a-f-]{36}$/.test(value));
}
function record(value: unknown): ProjectRecord {
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1
    || !("id" in value) || !isProjectId(value.id) || !("title" in value) || typeof value.title !== "string"
    || !("revision" in value) || typeof value.revision !== "string" || !value.revision || value.revision.length > 64
    || !("audioRevision" in value) || typeof value.audioRevision !== "string" || !value.audioRevision || value.audioRevision.length > 64
    || !("createdAt" in value) || !Number.isSafeInteger(value.createdAt) || Number(value.createdAt) < 0
    || !("updatedAt" in value) || !Number.isSafeInteger(value.updatedAt) || Number(value.updatedAt) < 0
    || !("clipCount" in value) || !Number.isInteger(value.clipCount) || Number(value.clipCount) < 0 || Number(value.clipCount) > 8
    || !("transport" in value) || !isTransportConfig(value.transport)) throw new LoopStorageError("corrupt", "프로젝트 목록 정보를 읽을 수 없습니다. 저장본은 보존됩니다.");
  if (projectTitle(value.title) !== value.title) throw new LoopStorageError("corrupt", "프로젝트 이름이 올바르지 않습니다.");
  return value as ProjectRecord;
}
function summary(value: ProjectRecord): ProjectSummary {
  return { ...value, updatedAtLabel: new Date(value.updatedAt).toLocaleString("ko-KR") };
}
function describe(id: string, title: string, saved: SavedStationSession, previous?: ProjectRecord): ProjectRecord {
  return { version: 1, id, title, revision: crypto.randomUUID(), audioRevision: saved.revision,
    createdAt: previous?.createdAt ?? saved.updatedAt, updatedAt: saved.updatedAt,
    clipCount: saved.history.tracks.filter((track) => track.current !== null).length, transport: projectTransport(saved.history) };
}
function conflict(): Error {
  return new LoopStorageError("conflict", "다른 탭에서 프로젝트가 변경되었습니다. 목록을 새로고침한 뒤 다시 시도하세요. 현재 작업은 유지됩니다.");
}

async function readProject(id: string): Promise<{ head: unknown; audio: unknown; meta: unknown }> {
  const db = await openLoopDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["heads", "sessions"], "readonly");
      const head = tx.objectStore("heads").get(id);
      const audio = tx.objectStore("sessions").get(id);
      const meta = tx.objectStore("heads").get(PREFIX + id);
      tx.oncomplete = () => resolve({ head: head.result as unknown, audio: audio.result as unknown, meta: meta.result as unknown });
      tx.onabort = () => reject(tx.error ?? new Error("프로젝트 읽기가 중단되었습니다."));
    });
  } finally { db.close(); }
}

/** Metadata and PCM commit atomically; asynchronous hashes finish before opening a transaction. */
async function commit(id: string, saved: SavedStationSession, expected: string | null, title?: string, source?: ProjectSummary): Promise<ProjectSummary> {
  const db = await openLoopDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["heads", "sessions"], "readwrite");
      const heads = tx.objectStore("heads");
      const head = heads.get(id);
      const meta = heads.get(PREFIX + id);
      const sourceHead = source ? heads.get(source.id) : null;
      const sourceMeta = source ? heads.get(PREFIX + source.id) : null;
      let result: ProjectRecord;
      let failure: unknown;
      (sourceMeta ?? meta).onsuccess = () => {
        try {
          if ((head.result ?? null) !== expected) throw conflict();
          const previous = meta.result === undefined ? undefined : record(meta.result);
          if (expected === null && previous) throw conflict();
          if (source && sourceHead && sourceMeta) {
            const current = record(sourceMeta.result);
            if (current.id !== source.id || current.revision !== source.revision
              || current.audioRevision !== source.audioRevision || sourceHead.result !== source.audioRevision) throw conflict();
          }
          if (!previous && id !== LEGACY_PROJECT_ID && expected !== null) throw conflict();
          result = describe(id, previous?.title ?? title ?? "로컬 프로젝트", saved, previous);
          tx.objectStore("sessions").put(saved, id);
          heads.put(saved.revision, id);
          heads.put(result, PREFIX + id);
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(summary(result));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error("프로젝트 저장이 중단되었습니다. 이전 저장본은 유지됩니다."));
    });
  } finally { db.close(); }
}

export class ProjectRepository implements SessionRepository<StationProject> {
  readonly scope: string;
  constructor(readonly id: string) {
    if (!isProjectId(id)) throw new Error("프로젝트 ID가 올바르지 않습니다.");
    this.scope = id;
  }
  async load(): Promise<SavedStationSession | null> {
    const stored = await readProject(this.id);
    if (stored.head === undefined && stored.audio === undefined && stored.meta === undefined && this.id === LEGACY_PROJECT_ID) return null;
    const saved = await decodeStationSession(stored.audio);
    if (stored.head !== saved.revision) throw new LoopStorageError("corrupt", "프로젝트 저장 리비전이 일치하지 않습니다.");
    if (stored.meta !== undefined && record(stored.meta).id !== this.id) throw new LoopStorageError("corrupt", "프로젝트 목록의 ID가 일치하지 않습니다.");
    if (stored.meta === undefined && this.id !== LEGACY_PROJECT_ID) throw new LoopStorageError("corrupt", "프로젝트 목록 정보가 없습니다.");
    return saved;
  }
  async save(history: StationProject, expectedRevision: string | null): Promise<SavedStationSession> {
    const saved = await createStationSession(history);
    await commit(this.id, saved, expectedRevision);
    return saved;
  }
}

export class ProjectCatalog {
  /** Register the old fixed-key project without changing its head, audio or undo history. */
  async registerLegacy(): Promise<void> {
    const db = await openLoopDatabase();
    let needsRegistration: boolean;
    try {
      needsRegistration = await new Promise((resolve, reject) => {
        const tx = db.transaction("heads", "readonly");
        const head = tx.objectStore("heads").get(LEGACY_PROJECT_ID);
        const meta = tx.objectStore("heads").get(PREFIX + LEGACY_PROJECT_ID);
        tx.oncomplete = () => {
          try { resolve(head.result !== undefined && (meta.result === undefined || record(meta.result).audioRevision !== head.result)); }
          catch (error) { reject(error); }
        };
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
    if (!needsRegistration) return;
    const saved = await new ProjectRepository(LEGACY_PROJECT_ID).load();
    if (!saved) return;
    const target = await openLoopDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = target.transaction("heads", "readwrite");
        const heads = tx.objectStore("heads");
        const head = heads.get(LEGACY_PROJECT_ID);
        const meta = heads.get(PREFIX + LEGACY_PROJECT_ID);
        let failure: unknown;
        meta.onsuccess = () => {
          try {
            if (head.result !== saved.revision) throw conflict();
            const previous = meta.result === undefined ? undefined : record(meta.result);
            if (previous?.audioRevision !== saved.revision) heads.put(describe(LEGACY_PROJECT_ID, previous?.title ?? "기존 로컬 프로젝트", saved, previous), PREFIX + LEGACY_PROJECT_ID);
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(failure ?? tx.error);
      });
    } finally { target.close(); }
  }
  async list(): Promise<ProjectSummary[]> {
    const db = await openLoopDatabase();
    try {
      const rows = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction("heads", "readonly");
        const request = tx.objectStore("heads").getAll(IDBKeyRange.bound(PREFIX, PREFIX + "\uffff"));
        tx.oncomplete = () => resolve(request.result as unknown[]);
        tx.onabort = () => reject(tx.error);
      });
      return rows.map((row) => summary(record(row))).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    } finally { db.close(); }
  }
  async create(title: string, transport: TransportConfig): Promise<{ project: ProjectSummary; saved: SavedStationSession }> {
    title = projectTitle(title);
    if (!isTransportConfig(transport)) throw new Error("템포는 40~240 BPM과 지원 박자표를 사용하세요.");
    const saved = await createStationSession({ tracks: emptyStationHistory(), mixer: defaultStationMix(), master: defaultMasterMix(), transport });
    const id = `loop-${crypto.randomUUID()}`;
    return { project: await commit(id, saved, null, title), saved };
  }
  async duplicate(source: ProjectSummary, title: string, retainedBytes: number): Promise<{ project: ProjectSummary; saved: SavedStationSession }> {
    title = projectTitle(title);
    if (!isProjectId(source.id)) throw new Error("프로젝트 ID가 올바르지 않습니다.");
    const stored = await readProject(source.id);
    const current = record(stored.meta);
    if (current.id !== source.id || current.revision !== source.revision || current.audioRevision !== source.audioRevision
      || stored.head !== source.audioRevision) throw conflict();
    const original = await decodeStationSession(stored.audio);
    if (original.revision !== stored.head) throw new LoopStorageError("corrupt", "원본 프로젝트의 저장 리비전이 일치하지 않습니다. 복제하지 않았습니다.");
    await checkDuplicateCapacity(original.history, retainedBytes);
    const saved = await createStationSession(original.history);
    const id = `loop-${crypto.randomUUID()}`;
    // Recheck BOTH source revisions in the write transaction after async work.
    return { project: await commit(id, saved, null, title, source), saved };
  }
  async rename(project: ProjectSummary, title: string): Promise<ProjectSummary> {
    title = projectTitle(title);
    const db = await openLoopDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("heads", "readwrite");
        const store = tx.objectStore("heads");
        const request = store.get(PREFIX + project.id);
        let result: ProjectRecord;
        let failure: unknown;
        request.onsuccess = () => {
          try {
            const previous = record(request.result);
            if (previous.revision !== project.revision || previous.id !== project.id) throw conflict();
            result = { ...previous, title, revision: crypto.randomUUID(), updatedAt: Date.now() };
            store.put(result, PREFIX + project.id);
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve(summary(result));
        tx.onabort = () => reject(failure ?? tx.error);
      });
    } finally { db.close(); }
  }
}
