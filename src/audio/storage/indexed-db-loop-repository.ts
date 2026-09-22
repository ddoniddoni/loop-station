import { createLoopSession, decodeLoopSession, LoopStorageError, type SessionRepository, type StoredSession, type SavedLoopSession } from "./loop-session";
import type { LoopHistoryState } from "../loop/loop-history";

const DATABASE = "loop-station-local";
const KEY = "track-01-session";

/** Bounded single-session wrapper. Head and PCM commit in one transaction. */
export class IndexedDbSessionRepository<State, Session extends StoredSession<State>> implements SessionRepository<State> {
  constructor(private readonly codec: {
    create(history: State): Promise<Session>;
    decode(value: unknown): Promise<Session>;
  }) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new LoopStorageError("unavailable", "이 브라우저에서는 로컬 저장소를 사용할 수 없습니다.")); return; }
      const request = indexedDB.open(DATABASE, 1);
      let cancelled = false;
      request.onblocked = () => {
        cancelled = true;
        reject(new LoopStorageError("blocked", "다른 탭이 저장소 변경을 막고 있습니다. 다른 탭을 닫은 뒤 재시도하세요."));
      };
      request.onupgradeneeded = () => {
        if (cancelled) { request.transaction?.abort(); return; }
        request.result.createObjectStore("heads");
        request.result.createObjectStore("sessions");
      };
      request.onerror = () => reject(request.error ?? new Error("저장소를 열지 못했습니다."));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        if (cancelled) db.close();
        else resolve(db);
      };
    });
  }

  async load(): Promise<Session | null> {
    const db = await this.open();
    try {
      const stored = await new Promise<{ head: unknown; session: unknown }>((resolve, reject) => {
        const tx = db.transaction(["heads", "sessions"], "readonly");
        const head = tx.objectStore("heads").get(KEY);
        const session = tx.objectStore("sessions").get(KEY);
        tx.oncomplete = () => resolve({ head: head.result as unknown, session: session.result as unknown });
        tx.onabort = () => reject(tx.error ?? new Error("저장된 루프를 불러오지 못했습니다."));
      });
      if (stored.head === undefined && stored.session === undefined) return null;
      const session = await this.codec.decode(stored.session);
      if (stored.head !== session.revision) throw new LoopStorageError("corrupt", "저장된 루프의 리비전이 일치하지 않습니다. 저장본은 변경하지 않았습니다.");
      return session;
    } finally { db.close(); }
  }

  async save(history: State, expectedRevision: string | null): Promise<Session> {
    // Hash before opening the write transaction: no asynchronous work inside it.
    return this.commit(await this.codec.create(history), expectedRevision);
  }

  private async commit(session: Session, expectedRevision: string | null): Promise<Session> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["heads", "sessions"], "readwrite");
        let failure: Error | null = null;
        const head = tx.objectStore("heads").get(KEY);
        head.onsuccess = () => {
          const current: unknown = head.result;
          if ((current ?? null) !== expectedRevision) {
            failure = new LoopStorageError("conflict", "다른 탭에서 저장 내용이 바뀌었습니다. 기존 저장본과 이 탭의 루프를 유지합니다.");
            tx.abort();
            return;
          }
          try {
            tx.objectStore("sessions").put(session, KEY);
            tx.objectStore("heads").put(session.revision, KEY);
          } catch (error) {
            failure = error instanceof Error ? error : new Error("오디오를 저장하지 못했습니다.");
            tx.abort();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(failure ?? tx.error ?? new Error("저장이 중단되었습니다. 이전 저장본은 유지됩니다."));
      });
      return session;
    } finally { db.close(); }
  }
}

export class IndexedDbLoopRepository extends IndexedDbSessionRepository<LoopHistoryState, SavedLoopSession> {
  constructor() { super({ create: createLoopSession, decode: decodeLoopSession }); }
}
