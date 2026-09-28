"use client";

import { Button, Heading, Text } from "@radix-ui/themes";
import { useSyncExternalStore, type KeyboardEvent } from "react";
import { DRUM_KIT, type DrumId } from "@/audio/instruments/drum-kit";
import { useAudioSessionContext, useRecordingInputController } from "@/components/audio/audio-engine-provider";
import { InstrumentRecording } from "./instrument-recording";
import { MelodicInstrument } from "./melodic-instrument";

const codes = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"];

function AudioPreparation() {
  const audio = useAudioSessionContext();
  if (audio.phase === "ready" || audio.phase === "playing") return null;
  const label = audio.phase === "suspended" ? "오디오 재개" : audio.phase === "starting" ? "오디오 준비 중…" : "오디오 시작";
  return <Button variant="soft" disabled={["starting", "stopping", "close-error"].includes(audio.phase)} onClick={() => void (audio.phase === "suspended" ? audio.resumeAudio() : audio.startAudio())}>{label}</Button>;
}

function DrumPreparation() {
  const audio = useAudioSessionContext();
  const recording = useRecordingInputController();
  const drums = useSyncExternalStore(recording.drums.subscribe, recording.drums.getSnapshot, recording.drums.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  if (audio.phase !== "ready" && audio.phase !== "playing") return null;
  if (drums.phase === "ready") return null;
  const label = drums.phase === "loading" ? "드럼 불러오는 중…" : drums.phase === "error" ? "음원 다시 불러오기" : "드럼 준비";
  return <Button variant="soft" disabled={drums.phase === "loading" || input.captureLocked} onClick={() => { recording.select("drums"); void recording.drums.load(); }}>{label}</Button>;
}

export function BuiltInInstrument({ trackId, onTrackChange }: { trackId: number; onTrackChange: (id: number) => void }) {
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
    <div className="station-library-head"><Text as="p" className="station-overline">BUILT-IN INSTRUMENT</Text><Heading as="h2" id="instrument-title" size="4">내장 악기</Heading><Text as="p" size="2" color="gray">비트 위에, 나만의 멜로디.</Text></div>
    <div className="station-instrument-body">
      <div className="station-drum-source" role="group" aria-label="녹음 입력 선택">
        <Button variant="outline" color="gray" aria-pressed={input.source === "microphone"} disabled={!audioReady || input.captureLocked} onClick={() => recording.select("microphone")}>마이크</Button>
        <Button variant="outline" aria-pressed={input.source === "drums"} disabled={!audioReady || input.captureLocked} onClick={prepare}>내장 드럼</Button>
        <Button variant="outline" aria-pressed={input.source === "piano"} disabled={!audioReady || input.captureLocked} onClick={() => { recording.select("piano"); void recording.melodic.load(); }}>피아노</Button>
        <Button variant="outline" aria-pressed={input.source === "guitar"} disabled={!audioReady || input.captureLocked} onClick={() => { recording.select("guitar"); void recording.melodic.load(); }}>기타</Button>
      </div>
      <AudioPreparation />
      {audio.issue && <Text as="p" size="1" role="status">{audio.issue}</Text>}
      {input.source === "piano" || input.source === "guitar" ? <MelodicInstrument trackId={trackId} onTrackChange={onTrackChange} /> : <>
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
      <InstrumentRecording trackId={trackId} onTrackChange={onTrackChange} source="drums" />
      <Text as="p" size="1" color="gray">패드 소리는 바로 들리며 녹음 버튼을 누른 구간만 저장됩니다. 녹음 중 입력 전환은 잠깁니다.</Text>
      <a className="station-sample-credit" href="/audio/drums/freepats-20220718/readme.txt" target="_blank" rel="noreferrer">음원: FreePats · Roberto · CC0</a>
      </>}
    </div>
  </aside>;
}
