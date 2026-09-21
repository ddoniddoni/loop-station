"use client";

import { Button, Card, Heading, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { isCapturePhase, type LoopSnapshot } from "@/audio/loop/loop-controller";
import { useLoopController, useMicrophoneController } from "@/components/audio/audio-engine-provider";
import { StudioIcon } from "@/components/ui/studio-icon";

const labels: Record<LoopSnapshot["phase"], string> = {
  empty: "EMPTY", preparing: "PREPARING", armed: "ARMED", recording: "RECORDING",
  overdubbing: "OVERDUB", playing: "PLAYING", stopped: "STOPPED", incomplete: "INCOMPLETE",
};

function RecordingAction({ snapshot, inputReady }: { snapshot: LoopSnapshot; inputReady: boolean }) {
  const controller = useLoopController();
  if (isCapturePhase(snapshot.phase)) {
    const overdub = snapshot.captureMode === "overdub";
    return <Button className="station-track-action" variant="outline" color="red" onClick={() => controller.cancel()}>
      <span>{overdub ? "오버더빙 취소" : "녹음 취소"}<small>{overdub ? "기존 루프 유지" : "현재 녹음 폐기"}</small></span>
    </Button>;
  }
  if (snapshot.hasClip) {
    const playing = snapshot.phase === "playing";
    return <Button className="station-track-action" variant="outline" disabled={!snapshot.connected || !snapshot.metadata?.complete || (!playing && snapshot.historyPending !== null)}
      onClick={() => playing ? controller.stop() : controller.play()}>
      <StudioIcon name={playing ? "stop" : "play"} size={16} />{playing ? "반복 정지" : "반복 재생"}
    </Button>;
  }
  return <Button className="station-track-action" variant="outline" disabled={!snapshot.connected || !inputReady} aria-describedby="recording-hint"
    onClick={() => void controller.record()}><span className="station-record-dot" /><span>[ RECORD 4 BARS ]<small>4마디 녹음</small></span></Button>;
}

function LoopEditControls({ snapshot, inputReady }: { snapshot: LoopSnapshot; inputReady: boolean }) {
  const controller = useLoopController();
  const busy = isCapturePhase(snapshot.phase) || snapshot.historyPending !== null;
  const canOverdub = snapshot.connected && inputReady && snapshot.phase === "playing" && !snapshot.pendingPlay && !busy;
  return <div className="station-track-tools station-recording-tools">
    <Button className="station-overdub-action" variant="outline" disabled={!canOverdub} aria-describedby="recording-hint"
      title="마이크를 연결하고 루프를 재생하면 한 바퀴 덧녹음할 수 있습니다." onClick={() => void controller.overdub()}>
      <StudioIcon name="plus" size={13} />오버더빙 · 1회
    </Button>
    <Button variant="outline" color="gray" disabled={!snapshot.canUndo || busy || !snapshot.connected}
      aria-label="01 오버더빙 되돌리기" title="직전 오버더빙 전으로 되돌리기" onClick={() => controller.changeHistory("undo")}>Undo</Button>
    <Button variant="outline" color="gray" disabled={!snapshot.canRedo || busy || !snapshot.connected}
      aria-label="01 오버더빙 다시 적용" title="되돌린 오버더빙 다시 적용" onClick={() => controller.changeHistory("redo")}>Redo</Button>
    <Button variant="outline" color="gray" disabled={!snapshot.hasClip || busy} onClick={() => controller.clear()}>비우기</Button>
    <Button variant="outline" color="gray" disabled={!snapshot.canRestore || busy} onClick={() => controller.restore()} aria-label="01 비운 루프 복구"><StudioIcon name="undo" size={13} /><span>복구</span></Button>
    {snapshot.historyPending && <Button className="station-overdub-action" variant="soft" color="gray" onClick={() => controller.cancelHistory()}>{snapshot.historyPending === "undo" ? "Undo" : "Redo"} 예약 취소</Button>}
  </div>;
}

function recordingHint(snapshot: LoopSnapshot, inputReady: boolean): string {
  if (!snapshot.connected) return "상단 AUDIO에서 오디오를 시작하세요.";
  if (snapshot.historyPending) return `다음 루프 경계에서 ${snapshot.historyPending === "undo" ? "Undo" : "Redo"} 적용`;
  if (snapshot.phase === "preparing") return "녹음 용량을 확인하고 있습니다.";
  if (snapshot.phase === "armed") return snapshot.captureMode === "overdub" ? "다음 루프부터 한 바퀴 덧녹음" : "다음 마디에서 녹음 시작";
  if (snapshot.phase === "recording") return "입력 녹음 중 · 4마디 후 자동 반복";
  if (snapshot.phase === "overdubbing") return "오버더빙 중 · 한 바퀴 후 자동 확정";
  if (snapshot.phase === "incomplete") return "중단된 녹음 · 부분 데이터 보관 중";
  if (snapshot.pendingPlay) return "다음 마디에서 재생 시작";
  if (snapshot.hasClip) return inputReady ? "재생 중 오버더빙 가능 · 직전 1회 Undo/Redo" : "오버더빙하려면 마이크를 연결하세요.";
  if (snapshot.canRestore) return "비운 루프 복구 가능 · 다음 녹음 완료 전까지";
  if (!inputReady) return "입력 설정에서 마이크를 연결하세요.";
  return "다음 마디부터 4마디 · 모노 입력";
}

export function RecordingTrack({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const controller = useLoopController();
  const microphone = useMicrophoneController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const input = useSyncExternalStore(microphone.subscribe, microphone.getSnapshot, microphone.getServerSnapshot);
  const inputReady = input.phase === "active" && input.routed;
  const duration = snapshot.metadata ? (snapshot.metadata.frames / snapshot.metadata.sampleRate).toFixed(1) : null;
  return (
    <Card size="1" asChild>
      <article className="station-track-card station-recording-track" data-tone="mint" data-track="01" data-bank="0" data-selected={selected} data-recording={snapshot.phase === "recording" || snapshot.phase === "overdubbing"} aria-label="01 Beat 녹음 트랙">
        <div className="station-track-header">
          <Heading as="h3" size="3"><button type="button" className="station-track-select" aria-pressed={selected} onClick={onSelect} aria-label="01 Beat 트랙 선택"><i aria-hidden="true" /><span><b>01</b> Beat</span></button></Heading>
          <span className="station-track-state">{snapshot.pendingPlay || snapshot.historyPending ? "QUEUED" : labels[snapshot.phase]}</span>
        </div>
        <div className="station-track-window station-recording-window">
          <StudioIcon name={snapshot.hasClip ? "loop" : "wave"} size={20} />
          <Text as="p" size="1">{duration ? `${duration}s · ${snapshot.metadata?.complete ? "4 BARS" : "PARTIAL"}` : "4 BARS · MONO"}</Text>
          <progress max={1} value={snapshot.progress} aria-label={snapshot.phase === "overdubbing" ? "오버더빙 진행" : snapshot.phase === "recording" ? "녹음 진행" : "루프 재생 위치"} />
        </div>
        <LoopEditControls snapshot={snapshot} inputReady={inputReady} />
        <RecordingAction snapshot={snapshot} inputReady={inputReady} />
        <p id="recording-hint" className="station-recording-hint" role="status">{recordingHint(snapshot, inputReady)}</p>
        {snapshot.hasClip && <p className="station-recording-hint">이 탭에만 보관 · 새로고침 시 사라짐</p>}
        {snapshot.issue && <p className="station-recording-issue" role="alert">{snapshot.issue}</p>}
        {snapshot.storageNote && <p className="station-recording-hint">{snapshot.storageNote}</p>}
      </article>
    </Card>
  );
}

export function RecordedClipDetails() {
  const controller = useLoopController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const meta = snapshot.metadata;
  return <><div className="station-clip-fields"><div><span>LOOP MODE</span><strong>{meta?.complete ? "4 BARS" : "—"}</strong></div><div><span>LENGTH</span><strong>{meta ? `${(meta.frames / meta.sampleRate).toFixed(2)}s` : "—"}</strong></div></div>
    <Text as="p" size="1" color="gray" mt="2">{meta ? `${meta.frames.toLocaleString()} frames · ${meta.sampleRate / 1000}kHz · ${meta.bpm} BPM` : "첫 번째 트랙에서 4마디를 녹음할 수 있습니다."}</Text>
    <Text as="p" size="1" color="gray" mt="2">한 바퀴 오버더빙 · 직전 1회 Undo/Redo. 입력 게인 적용 후 녹음하며 클릭은 제외합니다. 저장과 지연 보정은 준비 중입니다.</Text></>;
}
