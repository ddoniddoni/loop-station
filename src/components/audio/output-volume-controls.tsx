"use client";

import { Button, Slider, Text } from "@radix-ui/themes";
import { DEFAULT_OUTPUT_VOLUME, MAX_OUTPUT_VOLUME } from "@/audio/engine/output-volume";
import { useAudioSessionContext } from "./audio-engine-provider";

export function OutputVolumeControls() {
  const audio = useAudioSessionContext();
  const silent = audio.outputMuted || audio.outputVolume === 0;
  return <section className="station-output-volume" aria-labelledby="output-volume-title">
    <div className="station-output-label"><Text as="span" id="output-volume-title" weight="bold" size="2">전체 볼륨</Text><Text as="span" size="1" color="gray">루프 · 악기 · 클릭</Text></div>
    <Slider min={0} max={MAX_OUTPUT_VOLUME} step={10} value={[audio.outputVolume]} aria-label="전체 출력 볼륨"
      aria-valuetext={`${audio.outputVolume}%${audio.outputMuted ? " · 음소거 중" : ""}`} aria-describedby="output-volume-help"
      onValueChange={(values) => audio.setOutputVolume(values[0] ?? DEFAULT_OUTPUT_VOLUME)} />
    <output className="station-output-value" aria-live="off">{audio.outputVolume}%</output>
    <Button variant={audio.outputMuted ? "solid" : "outline"} color="gray" aria-pressed={audio.outputMuted}
      onClick={() => audio.setOutputMuted(!audio.outputMuted)}>{audio.outputMuted ? "전체 음소거 해제" : "전체 음소거"}</Button>
    <Button variant="soft" color="gray" onClick={() => { audio.setOutputVolume(DEFAULT_OUTPUT_VOLUME); audio.setOutputMuted(false); }}>기본 200%</Button>
    <Text as="p" size="1" color="gray" id="output-volume-help" className="station-output-help">
      {silent ? "전체 출력이 음소거되어 있습니다. " : ""}100% 기준 · 최대 400%. 듣는 크기만 바꾸며 녹음 원본은 유지합니다.
    </Text>
  </section>;
}
