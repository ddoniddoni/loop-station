"use client";

import { Badge, Button, Heading, Select, Text, TextField } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { TRANSPORT_METERS, type TransportConfig, type TransportSnapshot } from "@/audio/transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "@/audio/transport/timing";
import { ko } from "@/lib/i18n/ko";
import { StudioIcon } from "@/components/ui/studio-icon";

type TransportControlsProps = {
  enabled: boolean;
  snapshot: TransportSnapshot | null;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onConfigure: (config: TransportConfig) => void;
};

function positionParts(snapshot: TransportSnapshot | null): { bar: string; beat: string } {
  if (!snapshot) return { bar: "—", beat: "—" };
  const tick = Math.round(snapshot.positionTick);
  const barTicks = ticksPerBar(snapshot.numerator, snapshot.denominator);
  const beatTicks = PPQ * 4 / snapshot.denominator;
  const bar = Math.floor(tick / barTicks) + 1;
  const beat = Math.floor((tick % barTicks) / beatTicks) + 1;
  return { bar: String(bar), beat: String(beat) };
}

export function TransportControls({ enabled, snapshot, onStart, onStop, onReset, onConfigure }: TransportControlsProps) {
  const [draftBpm, setDraftBpm] = useState("120");
  const [draftMeter, setDraftMeter] = useState("4/4");
  const [issue, setIssue] = useState<string | null>(null);
  const ready = enabled && snapshot !== null;
  const position = positionParts(snapshot);

  function applySettings(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const bpm = Number(draftBpm);
    const meter = TRANSPORT_METERS.find(({ label }) => label === draftMeter);
    if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240 || !meter) {
      setIssue(ko.transportInvalidTempo);
      return;
    }
    setIssue(null);
    onConfigure({ bpm, numerator: meter.numerator, denominator: meter.denominator });
  }

  return (
    <section aria-labelledby="transport-title" className="station-transport">
      <div className="station-control-heading">
        <Heading as="h2" id="transport-title" size="3">{ko.transportTitle}</Heading>
        <Badge color={snapshot?.playing ? "jade" : "gray"} variant="soft">{snapshot?.playing ? ko.transportPlaying : ko.transportStopped}</Badge>
      </div>
      <div className="station-transport-main">
        <div className="station-counter" role="group" aria-label={ko.transportPosition}>
          <div><span>{ko.studioBar}</span><output aria-live="off" aria-label={`${position.bar} ${ko.studioBar}`}>{position.bar}</output></div>
          <span className="station-counter-divider" aria-hidden="true">:</span>
          <div><span>{ko.studioBeat}</span><output aria-live="off" aria-label={`${position.beat} ${ko.studioBeat}`}>{position.beat}</output></div>
        </div>
        <div className="station-transport-buttons">
          <Button type="button" disabled={!ready || snapshot?.playing} onClick={onStart}><StudioIcon name="play" />{ko.transportPlay}</Button>
          <Button type="button" variant="soft" color="gray" disabled={!ready || !snapshot?.playing} onClick={onStop}><StudioIcon name="stop" />{ko.transportStopShort}</Button>
          <Button type="button" variant="ghost" color="gray" disabled={!ready || (snapshot?.positionFrame === 0 && !snapshot?.playing)} onClick={onReset} aria-label={ko.transportReset} title={ko.transportReset}><StudioIcon name="undo" /></Button>
        </div>
      </div>
      <form onSubmit={applySettings} className="station-tempo-form">
        <div className="station-tempo-field">
          <label htmlFor="transport-bpm">{ko.transportTempoLabel}</label>
          <TextField.Root id="transport-bpm" type="number" min="40" max="240" step="1" inputMode="numeric"
            value={draftBpm} disabled={!ready} onChange={(event) => setDraftBpm(event.target.value)} />
        </div>
        <div className="station-tempo-field">
          <label htmlFor="transport-meter">{ko.transportMeter}</label>
          <Select.Root value={draftMeter} disabled={!ready} onValueChange={setDraftMeter}>
            <Select.Trigger id="transport-meter" aria-label={ko.transportMeter} />
            <Select.Content position="popper">
              {TRANSPORT_METERS.map((meter) => <Select.Item key={meter.label} value={meter.label}>{meter.label}</Select.Item>)}
            </Select.Content>
          </Select.Root>
        </div>
        <Button type="submit" variant="outline" disabled={!ready}>{ko.transportApply}</Button>
      </form>
      <Text as="p" size="1" color="gray" className="station-tempo-current">{snapshot ? `${ko.transportCurrentSetting} ${snapshot.bpm} BPM · ${snapshot.numerator}/${snapshot.denominator}` : ko.transportNeedsAudio}</Text>
      {issue && <Text as="p" role="alert" size="2" color="red" className="station-transport-issue">{issue}</Text>}
    </section>
  );
}
