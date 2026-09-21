"use client";

import { Button, Heading, Popover, Select, Text, TextField } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { TRANSPORT_METERS, type TransportConfig, type TransportSnapshot } from "@/audio/transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "@/audio/transport/timing";
import { ko } from "@/lib/i18n/ko";
import { StudioIcon } from "@/components/ui/studio-icon";

type TransportControlsProps = {
  enabled: boolean;
  settingsLocked: boolean;
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

export function TransportControls({ enabled, settingsLocked, snapshot, onStart, onStop, onReset, onConfigure }: TransportControlsProps) {
  const ready = enabled && snapshot !== null;
  const position = positionParts(snapshot);

  return (
    <section aria-label={ko.transportTitle} className="station-transport">
      <div className="station-transport-buttons">
        <Button type="button" className="station-transport-stop" variant="outline" color="gray" disabled={!ready || !snapshot?.playing} onClick={onStop} aria-label={ko.transportStop}><StudioIcon name="stop" size={18} /></Button>
        <Button type="button" className="station-transport-play" variant="outline" disabled={!ready || snapshot?.playing} onClick={onStart} aria-label={ko.transportPlay} data-playing={snapshot?.playing ?? false}><StudioIcon name="play" size={19} /><span>{snapshot?.playing ? "PLAYING" : "PLAY"}</span></Button>
      </div>
      <div className="station-counter" role="group" aria-label={ko.transportPosition}>
        <span className="station-counter-caption">TRANSPORT COUNTER</span>
        <div><span>BAR</span><output aria-live="off" aria-label={`${position.bar} ${ko.studioBar}`}>{position.bar}</output><span className="station-counter-divider" aria-hidden="true">|</span><span>BEAT</span><output aria-live="off" aria-label={`${position.beat} ${ko.studioBeat}`}>{position.beat}</output><i data-playing={snapshot?.playing ?? false} aria-hidden="true" /></div>
      </div>
      <TransportSettings enabled={enabled} settingsLocked={settingsLocked} snapshot={snapshot} onReset={onReset} onConfigure={onConfigure} />
    </section>
  );
}

function TransportSettings({ enabled, settingsLocked, snapshot, onReset, onConfigure }: Pick<TransportControlsProps, "enabled" | "settingsLocked" | "snapshot" | "onReset" | "onConfigure">) {
  const [draftBpm, setDraftBpm] = useState("120");
  const [draftMeter, setDraftMeter] = useState("4/4");
  const [issue, setIssue] = useState<string | null>(null);
  const ready = enabled && snapshot !== null;

  function applySettings(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (settingsLocked) return;
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
      <Popover.Root>
        <Popover.Trigger>
          <Button type="button" variant="outline" color="gray" className="station-tempo-trigger" aria-label="템포와 박자 설정">
            <span><strong>{snapshot?.bpm.toFixed(1) ?? "120.0"}</strong><small>BPM / {snapshot ? `${snapshot.numerator}/${snapshot.denominator}` : "4/4"}</small></span><StudioIcon name="settings" size={16} />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="station-overlay" width="300" sideOffset={8}>
          <Heading as="h2" size="3">{ko.transportTitle}</Heading>
          <form onSubmit={applySettings} className="station-tempo-form">
            <div className="station-tempo-field">
              <label htmlFor="transport-bpm">{ko.transportTempoLabel}</label>
              <TextField.Root id="transport-bpm" type="number" min="40" max="240" step="1" inputMode="numeric"
                value={draftBpm} disabled={!ready || settingsLocked} onChange={(event) => setDraftBpm(event.target.value)} />
            </div>
            <div className="station-tempo-field">
              <label htmlFor="transport-meter">{ko.transportMeter}</label>
              <Select.Root value={draftMeter} disabled={!ready || settingsLocked} onValueChange={setDraftMeter}>
                <Select.Trigger id="transport-meter" aria-label={ko.transportMeter} />
                <Select.Content position="popper">{TRANSPORT_METERS.map((meter) => <Select.Item key={meter.label} value={meter.label}>{meter.label}</Select.Item>)}</Select.Content>
              </Select.Root>
            </div>
            <Button type="submit" variant="outline" disabled={!ready || settingsLocked}>{ko.transportApply}</Button>
          </form>
          {settingsLocked && <Text as="p" size="2" color="gray" mt="2">녹음 또는 루프가 있는 동안 BPM·박자표는 고정됩니다. 트랙을 비우면 변경할 수 있습니다.</Text>}
          <Button type="button" variant="soft" color="gray" mt="3" disabled={!ready || (snapshot?.positionFrame === 0 && !snapshot?.playing)} onClick={onReset}><StudioIcon name="undo" size={16} />{ko.transportReset}</Button>
          <Text as="p" size="2" color="gray" mt="3">{snapshot ? `${ko.transportCurrentSetting} ${snapshot.bpm} BPM · ${snapshot.numerator}/${snapshot.denominator}` : ko.transportNeedsAudio}</Text>
          {issue && <Text as="p" role="alert" size="2" color="red" mt="2">{issue}</Text>}
        </Popover.Content>
      </Popover.Root>
  );
}
