"use client";

import { Badge, Button, Flex, Heading, Select, Text, TextField } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { TRANSPORT_METERS, type TransportConfig, type TransportSnapshot } from "@/audio/transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "@/audio/transport/timing";
import { ko } from "@/lib/i18n/ko";

type TransportControlsProps = {
  enabled: boolean;
  snapshot: TransportSnapshot | null;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onConfigure: (config: TransportConfig) => void;
};

function positionLabel(snapshot: TransportSnapshot | null): string {
  if (!snapshot) return ko.transportPositionUnknown;
  const tick = Math.round(snapshot.positionTick);
  const barTicks = ticksPerBar(snapshot.numerator, snapshot.denominator);
  const beatTicks = PPQ * 4 / snapshot.denominator;
  const bar = Math.floor(tick / barTicks) + 1;
  const beat = Math.floor((tick % barTicks) / beatTicks) + 1;
  return `${bar}:${beat}`;
}

export function TransportControls({ enabled, snapshot, onStart, onStop, onReset, onConfigure }: TransportControlsProps) {
  const [draftBpm, setDraftBpm] = useState("120");
  const [draftMeter, setDraftMeter] = useState("4/4");
  const [issue, setIssue] = useState<string | null>(null);
  const ready = enabled && snapshot !== null;

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
    <section aria-labelledby="transport-title" className="studio-subsection studio-transport">
      <div className="studio-section-heading">
        <Heading as="h3" id="transport-title" size="3" weight="medium">{ko.transportTitle}</Heading>
        <Badge color={snapshot?.playing ? "jade" : "gray"} variant="soft">
          {snapshot?.playing ? ko.transportPlaying : ko.transportStopped}
        </Badge>
      </div>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">{ko.transportDescription}</Text>
      <div className="studio-time-display">
        <div>
          <Text as="p" size="1" className="studio-display-label">{ko.transportPosition}</Text>
          <output aria-live="off" className="studio-time-number">{positionLabel(snapshot)}</output>
        </div>
        <div className="studio-time-meta" aria-label={ko.transportBpm}>
          <span>{snapshot?.bpm ?? draftBpm} <small>BPM</small></span>
          <span>{snapshot ? `${snapshot.numerator}/${snapshot.denominator}` : draftMeter}</span>
        </div>
      </div>
      <Flex gap="3" wrap="wrap" mt="4" className="studio-transport-actions">
        <Button type="button" disabled={!ready || snapshot?.playing} onClick={onStart}>{ko.transportPlay}</Button>
        <Button type="button" variant="soft" disabled={!ready || !snapshot?.playing} onClick={onStop}>{ko.transportStop}</Button>
        <Button type="button" variant="outline" color="gray" disabled={!ready || (snapshot?.positionFrame === 0 && !snapshot?.playing)} onClick={onReset}>
          {ko.transportReset}
        </Button>
      </Flex>
      <form onSubmit={applySettings} className="studio-transport-settings">
        <div>
          <label htmlFor="transport-bpm"><Text as="span" size="2">{ko.transportBpm}</Text></label>
          <TextField.Root id="transport-bpm" type="number" min="40" max="240" step="1" inputMode="numeric"
            value={draftBpm} disabled={!ready} onChange={(event) => setDraftBpm(event.target.value)} className="mt-2 w-24" />
        </div>
        <div>
          <label htmlFor="transport-meter"><Text as="span" size="2">{ko.transportMeter}</Text></label>
          <div className="mt-2">
            <Select.Root value={draftMeter} disabled={!ready} onValueChange={setDraftMeter}>
              <Select.Trigger id="transport-meter" aria-label={ko.transportMeter} />
              <Select.Content position="popper">
                {TRANSPORT_METERS.map((meter) => <Select.Item key={meter.label} value={meter.label}>{meter.label}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={!ready}>{ko.transportApply}</Button>
      </form>
      {issue && <Text as="p" role="alert" size="2" color="red" mt="3">{issue}</Text>}
      {!ready && <Text as="p" size="2" color="gray" mt="3">{ko.transportNeedsAudio}</Text>}
    </section>
  );
}
