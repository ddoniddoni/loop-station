"use client";

import { Button, Heading, Select, Text } from "@radix-ui/themes";
import { useId, useSyncExternalStore, type KeyboardEvent } from "react";
import { DRUM_KIT, type DrumId } from "@/audio/instruments/drum-kit";
import { isCapturePhase, type LoopSnapshot } from "@/audio/loop/loop-controller";
import { useAudioSessionContext, useLoopController, useRecordingInputController } from "@/components/audio/audio-engine-provider";
import { workspaceBlocksTrack } from "./track-availability";
import { RecordingLength } from "./recording-length";

const codes = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"];

function recordingMessage(state: LoopSnapshot): string {
  return state.issue ?? state.workspaceIssue ?? (state.save.editLocked ? "상단 LOCAL에서 저장 상태를 확인하세요." :
    state.blockedByTrack !== null ? `${state.blockedByTrack + 1}번 트랙 작업이 진행 중입니다.` :
    state.phase === "preparing" ? "녹음 용량 확인 중" : state.phase === "armed" ? "다음 마디부터 패드를 연주하세요." :
    state.phase === "recording" || state.phase === "overdubbing" ? "패드 연주를 녹음 중입니다. 끝나면 자동 반복합니다." :
    state.hasClip ? "루프를 재생하면 한 바퀴 덧녹음할 수 있습니다." : "녹음을 누르고 다음 마디부터 연주하세요.");
}

function DrumRecordingAction({ trackId, state, ready, busy }: { trackId: number; state: LoopSnapshot; ready: boolean; busy: boolean }) {
  const track = useLoopController(trackId);
  const capturing = isCapturePhase(state.phase);
  return <>{capturing ? <Button color="red" variant="outline" onClick={() => track.cancel()}>녹음 취소</Button> : state.hasClip ?
      <div className="station-drum-record-actions">
        <Button variant="outline" disabled={!state.connected || !state.metadata?.complete || busy} onClick={() => state.phase === "playing" ? track.stop() : track.play()}>{state.phase === "playing" ? "반복 정지" : "반복 재생"}</Button>
        <Button variant="outline" disabled={!ready || state.phase !== "playing" || state.pendingPlay} onClick={() => void track.overdub()}>덧녹음</Button>
      </div> : <Button variant="outline" disabled={!ready} onClick={() => void track.record()}>드럼 {state.recordBars}마디 녹음</Button>}</>;
}

function DrumPreparation() {
  const audio = useAudioSessionContext();
  const recording = useRecordingInputController();
  const drums = useSyncExternalStore(recording.drums.subscribe, recording.drums.getSnapshot, recording.drums.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  if (audio.phase !== "ready" && audio.phase !== "playing") {
    const label = audio.phase === "suspended" ? "오디오 재개" : audio.phase === "starting" ? "오디오 준비 중…" : "오디오 시작";
    return <Button variant="soft" disabled={["starting", "stopping", "close-error"].includes(audio.phase)} onClick={() => void (audio.phase === "suspended" ? audio.resumeAudio() : audio.startAudio())}>{label}</Button>;
  }
  if (drums.phase === "ready") return null;
  const label = drums.phase === "loading" ? "드럼 불러오는 중…" : drums.phase === "error" ? "음원 다시 불러오기" : "드럼 준비";
  return <Button variant="soft" disabled={drums.phase === "loading" || input.captureLocked} onClick={() => { recording.select("drums"); void recording.drums.load(); }}>{label}</Button>;
}

function DrumRecording({ trackId, onTrackChange }: { trackId: number; onTrackChange: (id: number) => void }) {
  const track = useLoopController(trackId);
  const recording = useRecordingInputController();
  const state = useSyncExternalStore(track.subscribe, track.getSnapshot, track.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const busy = workspaceBlocksTrack(state) || state.historyPending !== null;
  const ready = state.connected && input.source === "drums" && input.routed && !busy;
  const message = recordingMessage(state);
  const id = useId();
  return <div className="station-drum-recording">
    <label htmlFor={id}>녹음할 트랙</label>
    <Select.Root value={String(trackId)} onValueChange={(value) => onTrackChange(Number(value))} disabled={input.captureLocked}>
      <Select.Trigger id={id} />
      <Select.Content>{Array.from({ length: 8 }, (_, id) => <Select.Item key={id} value={String(id)}>트랙 {String(id + 1).padStart(2, "0")}</Select.Item>)}</Select.Content>
    </Select.Root>
    <RecordingLength trackId={trackId} snapshot={state} label="드럼 녹음 길이" />
    <DrumRecordingAction trackId={trackId} state={state} ready={ready} busy={busy} />
    <Text as="p" size="1" role="status">{message}</Text>
    <Text as="p" size="1" color="gray">Undo·비우기는 트랙에서. 목소리는 입력을 마이크로 바꾼 뒤 다른 트랙에 녹음하세요.</Text>
  </div>;
}

export function DrumInstrument({ trackId, onTrackChange }: { trackId: number; onTrackChange: (id: number) => void }) {
  const recording = useRecordingInputController();
  const audio = useAudioSessionContext();
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const drums = useSyncExternalStore(recording.drums.subscribe, recording.drums.getSnapshot, recording.drums.getServerSnapshot);
  const audioReady = audio.phase === "ready" || audio.phase === "playing";
  const canPlay = input.source === "drums" && input.routed && drums.running;
  const hit = (id: DrumId) => { recording.drums.trigger(id); };
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    if (event.repeat) { event.preventDefault(); return; }
    const pad = DRUM_KIT[codes.indexOf(event.code)];
    if (pad) { event.preventDefault(); hit(pad.id); }
  }
  function prepare() { recording.select("drums"); void recording.drums.load(); }
  return <aside id="library" tabIndex={-1} className="station-library station-instrument" aria-labelledby="instrument-title">
    <div className="station-library-head"><Text as="p" className="station-overline">BUILT-IN INSTRUMENT</Text><Heading as="h2" id="instrument-title" size="4">내장 드럼</Heading><Text as="p" size="2" color="gray">악기 없이, 첫 비트부터.</Text></div>
    <div className="station-instrument-body">
      <div className="station-drum-source" role="group" aria-label="녹음 입력 선택">
        <Button variant="outline" color="gray" aria-pressed={input.source === "microphone"} disabled={!audioReady || input.captureLocked} onClick={() => recording.select("microphone")}>마이크</Button>
        <Button variant="outline" aria-pressed={input.source === "drums"} disabled={!audioReady || input.captureLocked} onClick={prepare}>내장 드럼</Button>
      </div>
      <DrumPreparation />
      <Text as="p" size="1" role="status">{drums.issue ?? audio.issue ?? (canPlay ? "연주 준비됨 · 마이크 권한 없이 사용" : input.source === "microphone" ? "녹음 입력: 마이크 · 드럼을 선택하면 패드가 켜집니다." : "음원과 오디오 연결을 준비하고 있습니다.")}</Text>
      <div className="station-drum-pads" role="group" aria-label="드럼 패드">
        {DRUM_KIT.map((pad) => <Button key={pad.id} variant="outline" className="station-drum-pad" disabled={!canPlay} aria-label={`${pad.label} 연주`} onKeyDown={keyDown}
          onPointerDown={(event) => { if (event.button === 0) hit(pad.id); }} onClick={(event) => { if (event.detail === 0) hit(pad.id); }}>
          <span>{pad.label}</span><kbd>{pad.key}</kbd>
        </Button>)}
      </div>
      <Text as="p" size="1" color="gray">패드를 클릭·터치하세요. 패드에 초점을 둔 상태에서 A S D F · J K L ; 키로도 연주합니다.</Text>
      <Button variant="outline" color="gray" disabled={!canPlay} onClick={() => recording.drums.stopAll()}>패드 소리 끊기</Button>
      <DrumRecording trackId={trackId} onTrackChange={onTrackChange} />
      <Text as="p" size="1" color="gray">패드 소리는 바로 들리며 녹음 버튼을 누른 구간만 저장됩니다. 녹음 중 입력 전환은 잠깁니다.</Text>
      <a className="station-sample-credit" href="/audio/drums/freepats-20220718/readme.txt" target="_blank" rel="noreferrer">음원: FreePats · Roberto · CC0</a>
    </div>
  </aside>;
}
