"use client";

import { Button, Text } from "@radix-ui/themes";
import { useState, useSyncExternalStore } from "react";
import { GUITAR_CHORDS, type StrumDirection, type StrumSpeed } from "@/audio/instruments/guitar-chords";
import { useRecordingInputController } from "@/components/audio/audio-engine-provider";

export function GuitarChords({ ready }: { ready: boolean }) {
  const { melodic } = useRecordingInputController();
  const state = useSyncExternalStore(melodic.subscribe, melodic.getSnapshot, melodic.getServerSnapshot);
  const [direction, setDirection] = useState<StrumDirection>("down");
  const [speed, setSpeed] = useState<StrumSpeed>("normal");
  return <>
    <div className="station-guitar-options" role="group" aria-label="스트로크 방향">
      <Button variant="outline" aria-pressed={direction === "down"} onClick={() => setDirection("down")}>↓ 다운</Button>
      <Button variant="outline" aria-pressed={direction === "up"} onClick={() => setDirection("up")}>↑ 업</Button>
    </div>
    <div className="station-guitar-options station-guitar-speed" role="group" aria-label="스트로크 속도">
      {([ ["fast", "빠르게"], ["normal", "보통"], ["slow", "느리게"] ] as const).map(([value, label]) =>
        <Button key={value} variant="outline" color="gray" aria-pressed={speed === value} onClick={() => setSpeed(value)}>{label}</Button>)}
    </div>
    <div className="station-guitar-chords" role="group" aria-label="기타 코드 패드" aria-describedby="guitar-chord-help">
      {GUITAR_CHORDS.map((chord, index) => <Button key={chord.id} variant="outline" className="station-guitar-chord"
        disabled={!ready} data-ringing={state.chord === chord.id} aria-label={`${chord.name} 코드 연주`}
        onClick={() => melodic.strum(chord.id, direction, speed)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
          const match = /^Digit([1-8])$/.exec(event.code);
          if (match) {
            event.preventDefault();
            if (!event.repeat) melodic.strum(GUITAR_CHORDS[Number(match[1]) - 1].id, direction, speed);
          } else if (event.repeat && ["Enter", "Space"].includes(event.code)) event.preventDefault();
        }}>
        <strong>{chord.id}</strong><span>{chord.name.split(" ")[1]}</span><kbd>{index + 1}</kbd>
      </Button>)}
    </div>
    <Text as="p" size="1" color="gray" id="guitar-chord-help">코드를 누를 때마다 한 번 쓸어 연주합니다. 패드에 초점을 두고 1–8 키로도 연주할 수 있어요. 다운은 낮은 줄부터, 업은 높은 줄부터 울립니다. 다음 코드를 누르면 이전 소리는 멈춥니다.</Text>
  </>;
}
