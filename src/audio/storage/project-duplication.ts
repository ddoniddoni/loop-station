import { STATION_MEMORY_BYTES } from "../loop/station-protocol";
import { sessionTakes } from "./loop-session";
import type { StationProject } from "./station-session";

/** Count each track's retained audio, including Undo/Redo and cleared takes. */
export function projectPcmBytes(project: StationProject): number {
  let bytes = 0;
  for (const track of project.tracks) {
    const buffers = new Set(sessionTakes(track).flatMap((take) => take ? [take.pcm] : []));
    for (const buffer of buffers) bytes += buffer.byteLength;
  }
  return bytes;
}

export async function checkDuplicateCapacity(project: StationProject, retainedBytes: number): Promise<void> {
  const bytes = projectPcmBytes(project);
  // Audio has closed: retain the current project for rollback, plus the source
  // read and one hashing/IDB serialization copy. Never clone PCM again in JS.
  if (!Number.isSafeInteger(retainedBytes) || retainedBytes < 0 || retainedBytes + bytes * 2 > STATION_MEMORY_BYTES) {
    throw new Error("복제에 필요한 작업 메모리가 부족합니다. 원본과 현재 프로젝트는 유지됩니다.");
  }
  const storage = globalThis.navigator?.storage;
  if (!storage?.estimate) throw new Error("이 브라우저에서는 복제에 필요한 저장 여유 공간을 확인할 수 없습니다.");
  let estimate: StorageEstimate;
  try { estimate = await storage.estimate(); }
  catch { throw new Error("저장 공간 조회에 실패했습니다. 잠시 후 복제를 다시 시도하세요."); }
  const { quota, usage } = estimate;
  if (quota === undefined || usage === undefined || !Number.isFinite(quota) || !Number.isFinite(usage) || quota < 0 || usage < 0) {
    throw new Error("저장 여유 공간을 확인하지 못해 복제하지 않았습니다. 원본은 유지됩니다.");
  }
  // Conservative PCM allowance plus metadata; transaction errors remain final.
  if (quota - usage < bytes * 2 + 64 * 1024) throw new DOMException("복제할 저장 공간이 부족합니다.", "QuotaExceededError");
}

export function duplicateProjectTitle(title: string): string {
  // Do not cut an emoji's UTF-16 surrogate pair when respecting the 80-unit limit.
  let prefix = "";
  for (const character of title) {
    if (prefix.length + character.length > 76) break;
    prefix += character;
  }
  return `${prefix.trimEnd()} 사본`;
}
