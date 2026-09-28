"use client";

import { Button, Select, Text } from "@radix-ui/themes";
import { useId, useSyncExternalStore } from "react";
import { isCapturePhase, type LoopSnapshot } from "@/audio/loop/loop-controller";
import { useLoopController, useRecordingInputController } from "@/components/audio/audio-engine-provider";
import { workspaceBlocksTrack } from "./track-availability";
import { RecordingLength } from "./recording-length";

function recordingMessage(state: LoopSnapshot): string {
  return state.issue ?? state.workspaceIssue ?? (state.save.editLocked ? "상단 LOCAL에서 저장 상태를 확인하세요." :
    state.blockedByTrack !== null ? `${state.blockedByTrack + 1}번 트랙 작업이 진행 중입니다.` :
    state.phase === "preparing" ? "녹음 용량 확인 중" : state.phase === "armed" ? "다음 마디부터 악기를 연주하세요." :
    state.phase === "recording" || state.phase === "overdubbing" ? "악기 연주를 녹음 중입니다. 끝나면 자동 반복합니다." :
    state.hasClip ? "루프를 재생하면 한 바퀴 덧녹음할 수 있습니다." : "녹음을 누르고 다음 마디부터 연주하세요.");
}

function InstrumentRecordingAction({ trackId, state, ready, busy, label }: { trackId: number; state: LoopSnapshot; ready: boolean; busy: boolean; label: string }) {
  const track = useLoopController(trackId);
  const capturing = isCapturePhase(state.phase);
  return <>{capturing ? <Button color="red" variant="outline" onClick={() => track.cancel()}>녹음 취소</Button> : state.hasClip ?
      <div className="station-drum-record-actions">
        <Button variant="outline" disabled={!state.connected || !state.metadata?.complete || busy} onClick={() => state.phase === "playing" ? track.stop() : track.play()}>{state.phase === "playing" ? "반복 정지" : "반복 재생"}</Button>
        <Button variant="outline" disabled={!ready || state.phase !== "playing" || state.pendingPlay} onClick={() => void track.overdub()}>덧녹음</Button>
      </div> : <Button variant="outline" disabled={!ready} onClick={() => void track.record()}>{label} {state.recordBars}마디 녹음</Button>}</>;
}

export function InstrumentRecording({ trackId, onTrackChange, source }: { trackId: number; onTrackChange: (id: number) => void; source: "drums" | "piano" }) {
  const track = useLoopController(trackId);
  const recording = useRecordingInputController();
  const state = useSyncExternalStore(track.subscribe, track.getSnapshot, track.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const busy = workspaceBlocksTrack(state) || state.historyPending !== null;
  const ready = state.connected && input.source === source && input.routed && !busy;
  const label = source === "piano" ? "피아노" : "드럼";
  const message = recordingMessage(state);
  const id = useId();
  return <div className="station-drum-recording">
    <label htmlFor={id}>녹음할 트랙</label>
    <Select.Root value={String(trackId)} onValueChange={(value) => onTrackChange(Number(value))} disabled={input.captureLocked}>
      <Select.Trigger id={id} />
      <Select.Content>{Array.from({ length: 8 }, (_, id) => <Select.Item key={id} value={String(id)}>트랙 {String(id + 1).padStart(2, "0")}</Select.Item>)}</Select.Content>
    </Select.Root>
    <RecordingLength trackId={trackId} snapshot={state} label={`${label} 녹음 길이`} />
    <InstrumentRecordingAction trackId={trackId} state={state} ready={ready} busy={busy} label={label} />
    <Text as="p" size="1" role="status">{message}</Text>
    <Text as="p" size="1" color="gray">Undo·비우기는 트랙에서. 목소리는 입력을 마이크로 바꾼 뒤 다른 트랙에 녹음하세요.</Text>
  </div>;
}
