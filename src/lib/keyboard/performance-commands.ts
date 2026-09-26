import { isCapturePhase, type LoopController, type LoopSnapshot } from "../../audio/loop/loop-controller";

export type PerformanceCommand = "transport" | "primary" | "stop" | "cancel" | "undo" | "redo" | { trackId: number };
type KeyInput = Pick<KeyboardEvent, "key" | "keyCode" | "repeat" | "isComposing" | "defaultPrevented" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

/** Match logical keys: IME text and OS/browser combinations remain native. */
export function performanceCommand(event: KeyInput): PerformanceCommand | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (event.ctrlKey && event.metaKey) return null;
    return key === "z" ? event.shiftKey ? "redo" : "undo" : null;
  }
  if (event.shiftKey) return null;
  if (/^[1-8]$/.test(key)) return { trackId: Number(key) - 1 };
  switch (key) {
    case " ": return "transport";
    case "r": return "primary";
    case "s": return "stop";
    case "escape": return "cancel";
    default: return null;
  }
}

export type PerformanceAction = "transport-play" | "transport-stop" | "record" | "play" | "overdub" | "stop" | "cancel" | "cancel-history" | "undo" | "redo";
type PerformanceState = {
  track: LoopSnapshot;
  audioReady: boolean;
  inputReady: boolean;
  transportPlaying: boolean;
  projectBusy: boolean;
};
type Decision = { action: PerformanceAction; reason: null } | { action: null; reason: string };
const allow = (action: PerformanceAction): Decision => ({ action, reason: null });
const block = (reason: string): Decision => ({ action: null, reason });

/** Re-evaluated at keydown against controller snapshots, never a cached UI permission. */
export function performanceDecision(command: Exclude<PerformanceCommand, object>, state: PerformanceState): Decision {
  const { track, audioReady, inputReady, transportPlaying, projectBusy } = state;
  const capturing = isCapturePhase(track.phase);
  if (command === "cancel") {
    if (capturing) return allow("cancel");
    if (track.historyPending) return allow("cancel-history");
    if (track.pendingPlay) return allow("stop");
    return block("선택 트랙에 취소할 녹음이나 예약이 없습니다.");
  }
  if (!audioReady) return block("상단 AUDIO에서 오디오를 시작하거나 재개하세요.");
  if (command === "transport" && transportPlaying) return allow("transport-stop");
  if (command === "stop") {
    if (capturing) return block("녹음을 취소하려면 Esc를 누르세요.");
    return track.connected && (track.phase === "playing" || track.pendingPlay)
      ? allow("stop") : block("선택 트랙이 재생 중이 아닙니다.");
  }
  if (track.workspaceIssue) return block(track.workspaceIssue);
  if (track.save.editLocked) return block("저장·복구가 끝나거나 저장 문제를 해결한 뒤 조작할 수 있습니다.");
  if (projectBusy || capturing || track.historyPending || track.blockedByTrack !== null) return block("녹음·편집이 진행 중입니다. 해당 트랙에서 Esc로 취소할 수 있습니다.");
  if (command === "transport") return allow("transport-play");
  if (!track.connected) return block("선택 트랙의 오디오 연결을 기다려 주세요.");
  if (track.pendingPlay) return block("재생 예약 중입니다. Esc로 취소할 수 있습니다.");
  if (command === "undo" || command === "redo") {
    return (command === "undo" ? track.canUndo : track.canRedo) ? allow(command) : block("선택 트랙에 되돌리거나 다시 적용할 이력이 없습니다.");
  }
  if (track.hasClip) {
    if (!track.metadata?.complete) return block("중단된 녹음은 재생할 수 없습니다. 트랙의 복구·비우기를 확인하세요.");
    if (track.phase === "stopped") return allow("play");
    if (track.phase !== "playing") return block("선택 트랙의 작업이 끝나면 다시 시도하세요.");
    return inputReady ? allow("overdub") : block("오버더빙하려면 입력 설정에서 마이크를 연결하세요.");
  }
  return inputReady ? allow("record") : block("녹음하려면 입력 설정에서 마이크를 연결하세요.");
}

export const performanceActionLabels: Record<PerformanceAction, string> = {
  "transport-play": "전역 재생", "transport-stop": "전역 정지",
  record: "녹음", play: "반복 재생", overdub: "한 바퀴 오버더빙", stop: "트랙 정지",
  cancel: "녹음 취소", "cancel-history": "이력 예약 취소", undo: "Undo", redo: "Redo",
};

export function executePerformanceAction(action: PerformanceAction,
  track: Pick<LoopController, "record" | "play" | "overdub" | "stop" | "cancel" | "cancelHistory" | "changeHistory">,
  transport: { startTransport: () => void; stopTransport: () => void }): void {
  switch (action) {
    case "transport-play": transport.startTransport(); break;
    case "transport-stop": transport.stopTransport(); break;
    case "record": void track.record(); break;
    case "play": track.play(); break;
    case "overdub": void track.overdub(); break;
    case "stop": track.stop(); break;
    case "cancel": track.cancel(); break;
    case "cancel-history": track.cancelHistory(); break;
    case "undo": case "redo": track.changeHistory(action); break;
  }
}
