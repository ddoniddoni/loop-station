"use client";

import { Button, Slider, Text } from "@radix-ui/themes";
import type { MasterMix } from "@/audio/loop/track-mixer";
import { MAX_TRACK_DB, MIN_TRACK_DB } from "@/audio/loop/track-mixer";
import { useStationController } from "@/components/audio/audio-engine-provider";
import { OutputLevelMeter } from "./output-level-meter";
import { ko } from "@/lib/i18n/ko";

export function MixerMaster({ mix, disabled }: { mix: MasterMix; disabled: boolean }) {
  const controller = useStationController();
  const label = `${mix.gainDb > 0 ? "+" : ""}${mix.gainDb.toFixed(1)} dB`;
  return <div className="station-mixer-channel station-mixer-master">
    <div className="station-mixer-channel-head"><span>{ko.mixerMasterTitle}</span></div>
    <Text as="p" className="station-mixer-value">{label}</Text>
    <div className="station-mixer-slider">
      <Slider orientation="vertical" min={MIN_TRACK_DB} max={MAX_TRACK_DB} step={0.5} value={[mix.gainDb]}
        disabled={disabled} aria-label={ko.mixerMasterVolume} aria-valuetext={label} aria-describedby="mixer-master-help"
        onValueChange={(values) => controller.setMasterMix({ gainDb: values[0] ?? 0 })}
        onValueCommit={(values) => { controller.setMasterMix({ gainDb: values[0] ?? 0 }); controller.commitMixer(); }}
        onBlur={() => controller.commitMixer()} />
    </div>
    <Button variant={mix.mute ? "solid" : "outline"} color={mix.mute ? "orange" : "gray"}
      disabled={disabled} aria-pressed={mix.mute} aria-label={ko.mixerMasterMute} aria-describedby="mixer-master-help"
      onClick={() => { controller.setMasterMix({ mute: !mix.mute }); controller.commitMixer(); }}>BUS MUTE</Button>
    <div className="station-master-meters"><OutputLevelMeter channel="left" name="L" /><OutputLevelMeter channel="right" name="R" /></div>
    <Text as="p" id="mixer-master-help" size="1" color="gray">{ko.mixerMasterScope}</Text>
    <Button variant="outline" color="gray" onClick={() => controller.resetOutputMeters()}>{ko.mixerClearPeaks}</Button>
  </div>;
}
