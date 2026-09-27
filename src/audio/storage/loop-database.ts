import { LoopStorageError } from "./loop-session";

const DATABASE = "loop-station-local";

export function openLoopDatabase(): Promise<IDBDatabase> {
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
