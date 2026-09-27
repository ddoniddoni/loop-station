import type { LoopSaveState } from "@/audio/storage/loop-persistence";

const labels: Record<LoopSaveState["phase"], string> = {
  loading: "저장본 확인 중", empty: "녹음 후 자동 저장", saving: "저장 중…", saved: "이 기기에 저장됨",
  error: "저장 실패", conflict: "다른 탭 변경 감지", session: "이 탭에만 보관",
};
export function saveStatusLabel(save: LoopSaveState): string {
  return save.phase === "error" && save.editLocked ? "불러오기 실패" : labels[save.phase];
}

export function currentProjectStatus(save: LoopSaveState, performing: boolean, mixerDirty: boolean): string {
  if (performing) return "녹음·편집 중";
  if (mixerDirty) return "변경 저장 대기";
  return saveStatusLabel(save);
}
