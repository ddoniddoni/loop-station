"use client";

import { Button, Text } from "@radix-ui/themes";
import { useEffect, useSyncExternalStore, type KeyboardEvent } from "react";
import { PIANO_KEYS, type PianoOctave } from "@/audio/instruments/piano-bank";
import { useRecordingInputController } from "@/components/audio/audio-engine-provider";
import { InstrumentRecording } from "./instrument-recording";

function PianoKeyboard() {
  const recording = useRecordingInputController();
  const { piano } = recording;
  const state = useSyncExternalStore(piano.subscribe, piano.getSnapshot, piano.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const ready = input.source === "piano" && input.routed && state.running;
  const base = (state.octave + 1) * 12;
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const offset = PIANO_KEYS.findIndex((key) => key.code === event.code);
    if (offset < 0) { if (event.repeat && ["Enter", "Space"].includes(event.code)) event.preventDefault(); return; }
    event.preventDefault();
    if (!event.repeat) piano.noteOn(base + offset, `key:${event.code}`);
  }
  return <div className="station-piano-scroll">
    <div className="station-piano-keys" role="group" aria-label="피아노 건반" aria-describedby="piano-help">
      {PIANO_KEYS.map((key, index) => {
        const note = base + index;
        const octave = state.octave + (index === 12 ? 1 : 0);
        const precedingWhite = PIANO_KEYS.slice(0, index).filter((item) => item.white !== null).length;
        return <Button key={key.code} variant="outline" className="station-piano-key" data-black={key.white === null}
          data-held={state.notes.includes(note)} style={{ left: `${(key.white ?? precedingWhite) * 12.5}%` }}
          disabled={!ready} aria-label={`${key.name} ${key.note}${octave} 연주`} onKeyDown={keyDown}
          onKeyUp={(event) => { if (PIANO_KEYS.some((item) => item.code === event.code)) { event.preventDefault(); piano.noteOff(`key:${event.code}`); } }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            piano.noteOn(note, `pointer:${event.pointerId}`);
          }}
          onPointerUp={(event) => piano.noteOff(`pointer:${event.pointerId}`)}
          onPointerCancel={(event) => piano.noteOff(`pointer:${event.pointerId}`)}
          onLostPointerCapture={(event) => piano.noteOff(`pointer:${event.pointerId}`)}
          onClick={(event) => { if (event.detail === 0) { const token = `accessible:${key.code}`; piano.noteOn(note, token); piano.noteOff(token); } }}>
          <span>{key.note}{octave}</span><kbd>{key.key}</kbd>
        </Button>;
      })}
    </div>
  </div>;
}

export function PianoInstrument({ trackId, onTrackChange }: { trackId: number; onTrackChange: (id: number) => void }) {
  const recording = useRecordingInputController();
  const { piano } = recording;
  const state = useSyncExternalStore(piano.subscribe, piano.getSnapshot, piano.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const ready = input.source === "piano" && input.routed && state.running;
  useEffect(() => {
    const stop = () => piano.stopAll();
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", hide); stop(); };
  }, [piano]);
  return <>
    <div className="station-piano-performance" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) piano.stopAll(); }}>
      <div className="station-piano-toolbar" role="group" aria-label="피아노 옥타브">
        <Button variant="outline" color="gray" aria-label="피아노 한 옥타브 낮추기" disabled={input.captureLocked || state.octave === 3} onClick={() => void piano.setOctave((state.octave - 1) as PianoOctave)}>−</Button>
        <Text as="span" size="2">C{state.octave} — C{state.octave + 1}</Text>
        <Button variant="outline" color="gray" aria-label="피아노 한 옥타브 높이기" disabled={input.captureLocked || state.octave === 5} onClick={() => void piano.setOctave((state.octave + 1) as PianoOctave)}>+</Button>
      </div>
      {state.phase !== "ready" && <Button variant="soft" disabled={state.phase === "loading" || input.captureLocked} onClick={() => void piano.load()}>{state.phase === "loading" ? "피아노 불러오는 중…" : "피아노 음원 다시 불러오기"}</Button>}
      <Text as="p" size="1" role="status">{state.issue ?? (ready ? "연주 준비됨 · 여러 건반으로 화음을 만드세요." : "피아노 음원과 오디오 연결을 준비하고 있습니다.")}</Text>
      <PianoKeyboard />
      <Text as="p" size="1" color="gray" id="piano-help">건반을 누르는 동안 연주합니다. 건반에 초점을 두면 A–K와 W E T Y U로 화음을 연주할 수 있어요.</Text>
      <div className="station-drum-record-actions">
        <Button variant="outline" aria-pressed={state.sustain} disabled={!ready} onClick={() => piano.setSustain(!state.sustain)}>서스테인 {state.sustain ? "ON" : "OFF"}</Button>
        <Button variant="outline" color="gray" disabled={!ready} onClick={() => piano.stopAll()}>피아노 소리 끊기</Button>
      </div>
      <Text as="p" size="1" color="gray">옥타브 변경·연주 영역 이탈·탭 숨김 시 잔향과 서스테인을 끕니다. 녹음 중 옥타브는 고정됩니다.</Text>
    </div>
    <InstrumentRecording trackId={trackId} onTrackChange={onTrackChange} source="piano" />
    <a className="station-sample-credit" href="/audio/piano/freepats-20190703/readme.txt" target="_blank" rel="noreferrer">Upright Piano KW · Gonzalo & Roberto · CC0</a>
  </>;
}
