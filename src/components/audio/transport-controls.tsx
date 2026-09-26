"use client";

import { Button, Flex, Heading, Popover, Select, Text, TextField } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { TRANSPORT_METERS, type TransportConfig, type TransportSnapshot } from "@/audio/transport/audio-frame-clock";
import { TapTempo, type TapTempoResult } from "@/audio/transport/tap-tempo";
import { PPQ, ticksPerBar } from "@/audio/transport/timing";
import { ko } from "@/lib/i18n/ko";
import { StudioIcon } from "@/components/ui/studio-icon";

type TransportControlsProps = {
  enabled: boolean;
  settingsLocked: boolean;
  snapshot: TransportSnapshot | null;
  savedConfig: TransportConfig | null;
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

export function TransportControls({ enabled, settingsLocked, snapshot, savedConfig, onStart, onStop, onReset, onConfigure }: TransportControlsProps) {
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
      <TransportSettings enabled={enabled} settingsLocked={settingsLocked} snapshot={snapshot} savedConfig={savedConfig} onReset={onReset} onConfigure={onConfigure} />
    </section>
  );
}

function TransportSettings({ enabled, settingsLocked, snapshot, savedConfig, onReset, onConfigure }: Pick<TransportControlsProps, "enabled" | "settingsLocked" | "snapshot" | "savedConfig" | "onReset" | "onConfigure">) {
  const [open, setOpen] = useState(false);
  const ready = enabled && snapshot !== null;
  const displayConfig = snapshot ?? savedConfig;

  return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          <Button type="button" variant="outline" color="gray" className="station-tempo-trigger" aria-label="템포와 박자 설정">
            <span><strong>{displayConfig?.bpm.toFixed(1) ?? "120.0"}</strong><small>BPM / {displayConfig ? `${displayConfig.numerator}/${displayConfig.denominator}` : "4/4"}</small></span><StudioIcon name="settings" size={16} />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="station-overlay" width="300" sideOffset={8}>
          <Heading as="h2" size="3">{ko.transportTitle}</Heading>
          {open && <TransportSettingsForm key={`${ready}:${settingsLocked}`} ready={ready} settingsLocked={settingsLocked}
            initialConfig={displayConfig} onConfigure={onConfigure} />}
          <Button type="button" variant="soft" color="gray" mt="3" disabled={!ready || (snapshot?.positionFrame === 0 && !snapshot?.playing)} onClick={onReset}><StudioIcon name="undo" size={16} />{ko.transportReset}</Button>
          <Text as="p" size="2" color="gray" mt="3">{snapshot ? `${ko.transportCurrentSetting} ${snapshot.bpm} BPM · ${snapshot.numerator}/${snapshot.denominator}` : ko.transportNeedsAudio}</Text>
        </Popover.Content>
      </Popover.Root>
  );
}

function tapStatus(result: TapTempoResult): string {
  switch (result.status) {
    case "idle": return ko.tapTempoIdle;
    case "waiting": return ko.tapTempoWaiting;
    case "restarted": return ko.tapTempoRestarted;
    case "too-fast": return ko.tapTempoTooFast;
    case "invalid": return ko.tapTempoInvalid;
    case "ready": return `제안 · ${result.bpm} BPM · 최근 ${result.intervals}개 간격 · 설정 적용 전`;
  }
}

function TransportSettingsForm({ ready, settingsLocked, initialConfig, onConfigure }: {
  ready: boolean;
  settingsLocked: boolean;
  initialConfig: TransportConfig | null;
  onConfigure: (config: TransportConfig) => void;
}) {
  const [draftBpm, setDraftBpm] = useState(() => String(initialConfig?.bpm ?? 120));
  const [draftMeter, setDraftMeter] = useState(() => initialConfig ? `${initialConfig.numerator}/${initialConfig.denominator}` : "4/4");
  const [issue, setIssue] = useState<string | null>(null);
  const [tapTempo] = useState(() => new TapTempo());
  const [tapResult, setTapResult] = useState<TapTempoResult>({ status: "idle", bpm: null, intervals: 0 });
  const disabled = !ready || settingsLocked;
  const disabledReason = settingsLocked ? ko.transportSettingsLocked : !ready ? ko.transportNeedsAudio : null;

  function applySettings(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled) return;
    const bpm = Number(draftBpm);
    const meter = TRANSPORT_METERS.find(({ label }) => label === draftMeter);
    if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240 || !meter) {
      setIssue(ko.transportInvalidTempo);
      return;
    }
    setIssue(null);
    setTapResult(tapTempo.reset());
    onConfigure({ bpm, numerator: meter.numerator, denominator: meter.denominator });
  }

  function tap(timestamp: number): void {
    if (disabled) return;
    const result = tapTempo.tap(timestamp);
    setTapResult(result);
    if (result.status === "ready" && result.bpm !== null) {
      setDraftBpm(String(result.bpm));
      setIssue(null);
    }
  }

  return <>
    <form onSubmit={applySettings} className="station-tempo-form">
      <div className="station-tempo-field">
        <label htmlFor="transport-bpm">{ko.transportTempoLabel}</label>
        <TextField.Root id="transport-bpm" type="number" min="40" max="240" step="1" inputMode="numeric"
          value={draftBpm} disabled={disabled} onChange={(event) => {
            setDraftBpm(event.target.value); setTapResult(tapTempo.reset()); setIssue(null);
          }} />
      </div>
      <div className="station-tempo-field">
        <label htmlFor="transport-meter">{ko.transportMeter}</label>
        <Select.Root value={draftMeter} disabled={disabled} onValueChange={setDraftMeter}>
          <Select.Trigger id="transport-meter" aria-label={ko.transportMeter} />
          <Select.Content position="popper">{TRANSPORT_METERS.map((meter) => <Select.Item key={meter.label} value={meter.label}>{meter.label}</Select.Item>)}</Select.Content>
        </Select.Root>
      </div>
      <Flex direction="column" gap="2" width="100%">
        <Button type="button" variant="soft" size="3" disabled={disabled} aria-describedby="tap-tempo-help tap-tempo-status"
          onClick={(event) => tap(event.timeStamp)} onKeyDown={(event) => {
            if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
          }}>{ko.tapTempoButton}</Button>
        <Text as="p" id="tap-tempo-help" size="1" color="gray">{ko.tapTempoHelp}</Text>
        <Text as="p" id="tap-tempo-status" size="1" color="gray" role="status">{disabledReason ?? tapStatus(tapResult)}</Text>
      </Flex>
      <Button type="submit" variant="outline" disabled={disabled}>{ko.transportApply}</Button>
    </form>
    {issue && <Text as="p" role="alert" size="2" color="red" mt="2">{issue}</Text>}
  </>;
}
