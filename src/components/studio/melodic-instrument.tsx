"use client";

import { Button, Text } from "@radix-ui/themes";
import { useEffect, useSyncExternalStore, type KeyboardEvent } from "react";
import { PIANO_KEYS } from "@/audio/instruments/piano-bank";
import { melodicBase, MELODIC_INSTRUMENTS } from "@/audio/instruments/melodic-bank";
import { useRecordingInputController } from "@/components/audio/audio-engine-provider";
import { InstrumentRecording } from "./instrument-recording";
import { GuitarChords } from "./guitar-chords";
import { MelodicSetup } from "./melodic-setup";

const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const syllables = ["도", "도♯", "레", "레♯", "미", "파", "파♯", "솔", "솔♯", "라", "라♯", "시"];
function noteLabel(note: number): string { return `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`; }

function MelodicKeys() {
  const recording = useRecordingInputController();
  const { melodic } = recording;
  const state = useSyncExternalStore(melodic.subscribe, melodic.getSnapshot, melodic.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const ready = input.source === state.instrument && input.routed && state.running;
  const base = melodicBase(state.instrument, state.octave);
  const piano = state.instrument === "piano";
  const label = MELODIC_INSTRUMENTS[state.instrument].label;
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const offset = PIANO_KEYS.findIndex((key) => key.code === event.code);
    if (offset < 0) { if (event.repeat && ["Enter", "Space"].includes(event.code)) event.preventDefault(); return; }
    event.preventDefault();
    if (!event.repeat) melodic.noteOn(base + offset, `key:${event.code}`);
  }
  return <div className={piano ? "station-piano-scroll" : "station-guitar-scroll"}>
    <div className={piano ? "station-piano-keys" : "station-guitar-notes"} role="group" aria-label={`${label} ${piano ? "건반" : "음표 패드"}`} aria-describedby="melodic-help">
      {PIANO_KEYS.map((key, index) => {
        const note = base + index;
        const precedingWhite = PIANO_KEYS.slice(0, index).filter((item) => item.white !== null).length;
        return <Button key={key.code} variant="outline" className={piano ? "station-piano-key" : "station-guitar-note"} data-black={piano ? key.white === null : noteNames[note % 12].includes("♯")}
          data-held={state.notes.includes(note)} style={piano ? { left: `${(key.white ?? precedingWhite) * 12.5}%` } : undefined}
          disabled={!ready} aria-label={`${piano ? syllables[note % 12] : "기타"} ${noteLabel(note)} 연주`} onKeyDown={keyDown}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            melodic.noteOn(note, `pointer:${event.pointerId}`);
          }}
          onPointerUp={(event) => melodic.noteOff(`pointer:${event.pointerId}`)}
          onPointerCancel={(event) => melodic.noteOff(`pointer:${event.pointerId}`)}
          onLostPointerCapture={(event) => melodic.noteOff(`pointer:${event.pointerId}`)}
          onClick={(event) => { if (event.detail === 0) { const token = `accessible:${key.code}`; melodic.noteOn(note, token); melodic.noteOff(token); } }}>
          <span>{noteLabel(note)}</span><kbd>{key.key}</kbd>
        </Button>;
      })}
    </div>
  </div>;
}

export function MelodicInstrument({ trackId, onTrackChange }: { trackId: number; onTrackChange: (id: number) => void }) {
  const recording = useRecordingInputController();
  const { melodic } = recording;
  const state = useSyncExternalStore(melodic.subscribe, melodic.getSnapshot, melodic.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const ready = input.source === state.instrument && input.routed && state.running;
  const config = MELODIC_INSTRUMENTS[state.instrument];
  const chords = state.instrument === "guitar" && state.guitarMode === "chords";
  useEffect(() => {
    const stop = () => melodic.stopAll();
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", hide); stop(); };
  }, [melodic]);
  return <>
    <div className="station-piano-performance" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) melodic.stopAll(); }}
      onKeyUp={(event) => { if (PIANO_KEYS.some((item) => item.code === event.code)) { event.preventDefault(); melodic.noteOff(`key:${event.code}`); } }}>
      <MelodicSetup />
      {chords ? <GuitarChords ready={ready} /> : <>
        <MelodicKeys />
        <Text as="p" size="1" color="gray" id="melodic-help">{state.instrument === "piano" ? "건반을 누르는 동안 연주합니다. 건반에 초점을 두면 A–K와 W E T Y U로 화음을 연주할 수 있어요." : "음표를 누르면 나일론 기타를 튕깁니다. 패드에 초점을 둔 뒤 표시된 키를 함께 누르면 화음이 됩니다. 손을 놓으면 잔향이 줄어듭니다."}</Text>
      </>}
      <div className="station-drum-record-actions">
        {config.sustain && <Button variant="outline" aria-pressed={state.sustain} disabled={!ready} onClick={() => melodic.setSustain(!state.sustain)}>서스테인 {state.sustain ? "ON" : "OFF"}</Button>}
        <Button variant="outline" color="gray" disabled={!ready} onClick={() => melodic.stopAll()}>{config.label} 소리 끊기</Button>
      </div>
      <Text as="p" size="1" color="gray">연주 방식·옥타브 변경, 연주 영역 이탈, 탭 숨김 시 남은 소리를 끕니다. 녹음 중에는 연주 방식과 옥타브가 고정됩니다.</Text>
    </div>
    <InstrumentRecording trackId={trackId} onTrackChange={onTrackChange} source={state.instrument} />
    <a className="station-sample-credit" href={`${config.assetPath}readme.txt`} target="_blank" rel="noreferrer">{config.credit}</a>
  </>;
}
