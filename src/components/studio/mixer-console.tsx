"use client";

import { Button, Heading, Slider, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { MAX_TRACK_DB, MIN_TRACK_DB, trackIsAudible, type TrackMix } from "@/audio/loop/track-mixer";
import { useStationController } from "@/components/audio/audio-engine-provider";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";
import { MixerMaster } from "./mixer-master";
import { OutputLevelMeter } from "./output-level-meter";

type Slot = { number: string; name: string; tone: string };
type ChannelProps = {
  slot: Slot; mix: TrackMix; anySolo: boolean; disabled: boolean;
  onChange: (patch: Partial<TrackMix>) => void; onCommit: () => void;
};

function MixerPan({ number, pan, disabled, onChange, onCommit }: Pick<ChannelProps, "disabled" | "onChange" | "onCommit"> & { number: string; pan: number }) {
  const label = pan === 0 ? ko.mixerPanCenter : `${pan < 0 ? "L" : "R"} ${Math.round(Math.abs(pan) * 100)}`;
  return <div className="station-mixer-pan-control">
    <Text as="p">PAN · {label}</Text>
    <Slider min={-1} max={1} step={0.01} value={[pan]} disabled={disabled}
      aria-label={`${number} ${ko.mixerPan}`} aria-valuetext={label} aria-describedby="mixer-help"
      onValueChange={(values) => onChange({ pan: values[0] ?? 0 })}
      onValueCommit={(values) => { onChange({ pan: values[0] ?? 0 }); onCommit(); }} onBlur={onCommit} />
  </div>;
}

function MixerChannel({ slot, mix, anySolo, disabled, onChange, onCommit }: ChannelProps) {
  const label = `${mix.gainDb > 0 ? "+" : ""}${mix.gainDb.toFixed(1)} dB`;
  const audible = trackIsAudible(mix, anySolo);
  const status = mix.mute ? ko.mixerMuted : anySolo && !mix.solo ? ko.mixerExcluded : mix.solo ? ko.mixerSolo : ko.mixerIncluded;
  function toggle(key: "mute" | "solo") { onChange({ [key]: !mix[key] }); onCommit(); }

  return <div className="station-mixer-channel station-mixer-live" data-tone={slot.tone}
    data-bank={Number(slot.number) <= 4 ? 0 : 1} data-mix-track={slot.number} data-audible={audible}>
    <div className="station-mixer-channel-head"><span>{slot.number} {slot.name}</span></div>
    <MixerPan number={slot.number} pan={mix.pan} disabled={disabled} onChange={onChange} onCommit={onCommit} />
    <Text as="p" className="station-mixer-value">{label}</Text>
    <div className="station-mixer-slider">
      <Slider orientation="vertical" min={MIN_TRACK_DB} max={MAX_TRACK_DB} step={0.5} value={[mix.gainDb]}
        disabled={disabled} aria-label={`${slot.number} ${ko.mixerVolume}`} aria-valuetext={label}
        aria-describedby="mixer-help" onValueChange={(values) => onChange({ gainDb: values[0] ?? 0 })}
        onValueCommit={(values) => {
          // Radix keyboard commits can precede onValueChange. Persist the committed value explicitly.
          onChange({ gainDb: values[0] ?? 0 });
          onCommit();
        }} onBlur={onCommit} />
    </div>
    <Text as="p" className="station-mixer-track-status">{status}</Text>
    <div className="station-mixer-buttons">
      <Button size="1" color={mix.mute ? "orange" : "gray"} variant={mix.mute ? "solid" : "outline"}
        disabled={disabled} aria-label={`${slot.number} ${ko.studioMute}`} aria-pressed={mix.mute}
        aria-describedby="mixer-help" onClick={() => toggle("mute")}>M</Button>
      <Button size="1" color={mix.solo ? "mint" : "gray"} variant={mix.solo ? "solid" : "outline"}
        disabled={disabled} aria-label={`${slot.number} ${ko.studioSolo}`} aria-pressed={mix.solo}
        aria-describedby="mixer-help" onClick={() => toggle("solo")}>S</Button>
    </div>
    <OutputLevelMeter channel={Number(slot.number) - 1} name={slot.number} />
  </div>;
}

export function MixerConsole({ bank, onBankChange, slots }: {
  bank: number; onBankChange: (bank: number) => void; slots: readonly Slot[];
}) {
  const controller = useStationController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const { mixer, master, save, performing, mixerPending } = snapshot;
  const anySolo = mixer.some((track) => track.solo);
  const solos = mixer.flatMap((track, index) => track.solo ? [slots[index].number] : []);
  const disabled = save.editLocked || performing;
  const status = disabled ? ko.mixerLocked : mixerPending ? ko.mixerApplying : ko.mixerReady;

  return <section id="mixer" tabIndex={-1} className="station-mixer" data-bank={bank} aria-labelledby="mixer-title">
    <div className="station-mixer-heading">
      <Heading as="h2" id="mixer-title" size="2"><StudioIcon name="mixer" size={16} />MIXER CONSOLE <span>8 TRACKS</span></Heading>
      <Text as="span" size="1" color="gray" role="status">{status}</Text>
    </div>
    <div className="station-bank-switch station-mixer-banks">
      <Button variant="outline" color="gray" aria-pressed={bank === 0} onClick={() => onBankChange(0)}>Bank 1–4</Button>
      <Button variant="outline" color="gray" aria-pressed={bank === 1} onClick={() => onBankChange(1)}>Bank 5–8</Button>
    </div>
    <Text as="p" id="mixer-help" className="station-mixer-help">{ko.mixerHelp}</Text>
    <Text as="p" className="station-mixer-help">{ko.mixerMeterHelp}</Text>
    {anySolo && <Text as="p" className="station-mixer-help">{ko.mixerSoloTracks}: {solos.join(", ")}</Text>}
    <div className="station-mixer-channels">
      {slots.map((slot, trackId) => <MixerChannel key={slot.number} slot={slot} mix={mixer[trackId]}
        anySolo={anySolo} disabled={disabled} onChange={(patch) => controller.setTrackMix(trackId, patch)}
        onCommit={() => controller.commitMixer()} />)}
      <MixerMaster mix={master} disabled={disabled} />
    </div>
  </section>;
}
