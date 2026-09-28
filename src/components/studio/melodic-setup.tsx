"use client";

import { Button, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { melodicBase, MELODIC_INSTRUMENTS } from "@/audio/instruments/melodic-bank";
import { useRecordingInputController } from "@/components/audio/audio-engine-provider";

export function MelodicSetup() {
  const recording = useRecordingInputController();
  const { melodic } = recording;
  const state = useSyncExternalStore(melodic.subscribe, melodic.getSnapshot, melodic.getServerSnapshot);
  const input = useSyncExternalStore(recording.subscribe, recording.getSnapshot, recording.getServerSnapshot);
  const config = MELODIC_INSTRUMENTS[state.instrument];
  const chords = state.instrument === "guitar" && state.guitarMode === "chords";
  const ready = input.source === state.instrument && input.routed && state.running;
  const base = melodicBase(state.instrument, state.octave);
  const note = state.instrument === "guitar" ? "E" : "C";
  const octave = Math.floor(base / 12) - 1;
  const help = chords ? "코드 준비됨 · 녹음 중에도 코드를 바꿔 연주할 수 있어요." : "연주 준비됨 · 여러 음을 함께 눌러 화음을 만드세요.";
  return <>
    {state.instrument === "guitar" && <div className="station-guitar-options" role="group" aria-label="기타 연주 방식">
      <Button variant="outline" aria-pressed={!chords} disabled={input.captureLocked} onClick={() => void melodic.setGuitarMode("notes")}>단음</Button>
      <Button variant="outline" aria-pressed={chords} disabled={input.captureLocked} onClick={() => void melodic.setGuitarMode("chords")}>코드 · 스트로크</Button>
    </div>}
    {!chords && <div className="station-piano-toolbar" role="group" aria-label={`${config.label} 옥타브`}>
      <Button variant="outline" color="gray" aria-label={`${config.label} 한 옥타브 낮추기`} disabled={input.captureLocked || state.octave === config.octaves[0]} onClick={() => void melodic.setOctave(state.octave - 1)}>−</Button>
      <Text as="span" size="2">{note}{octave} — {note}{octave + 1}</Text>
      <Button variant="outline" color="gray" aria-label={`${config.label} 한 옥타브 높이기`} disabled={input.captureLocked || state.octave === config.octaves[2]} onClick={() => void melodic.setOctave(state.octave + 1)}>+</Button>
    </div>}
    {state.phase !== "ready" && <Button variant="soft" disabled={state.phase === "loading" || input.captureLocked} onClick={() => void melodic.load()}>{state.phase === "loading" ? `${config.label} 불러오는 중…` : `${config.label} 음원 다시 불러오기`}</Button>}
    <Text as="p" size="1" role="status">{state.issue ?? (ready ? help : `${config.label} 음원과 오디오 연결을 준비하고 있습니다.`)}</Text>
  </>;
}
