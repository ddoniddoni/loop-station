"use client";

import { Button, Heading, Popover, Slider, Switch, Text } from "@radix-ui/themes";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

type MetronomeControlsProps = {
  audioReady: boolean;
  enabled: boolean | null;
  volume: number;
  countInEnabled: boolean;
  captureLocked: boolean;
  onCountInChange: (enabled: boolean) => void;
  onEnabledChange: (enabled: boolean) => void;
  onVolumeChange: (volume: number) => void;
};

export function MetronomeControls({ audioReady, enabled, volume, countInEnabled, captureLocked, onCountInChange, onEnabledChange, onVolumeChange }: MetronomeControlsProps) {
  const ready = audioReady && enabled !== null;
  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button type="button" className="station-metronome-trigger" variant="outline" color="gray" data-active={enabled === true} aria-label={`메트로놈 설정: ${enabled ? ko.microphoneSettingOn : ko.microphoneSettingOff}`}>
          <StudioIcon name="clock" size={16} /><span>METRO<small>{enabled ? "ON" : "OFF"} · IN {countInEnabled ? "1" : "0"}</small></span>
        </Button>
      </Popover.Trigger>
      <Popover.Content className="station-overlay" width="280" sideOffset={8}>
        <Heading as="h2" size="3">{ko.metronomeTitle}</Heading>
        <div className="station-metro-switch">
          <Switch id="metronome-enabled" checked={enabled ?? false} disabled={!ready} onCheckedChange={onEnabledChange} />
          <label htmlFor="metronome-enabled">{ko.metronomeEnabled}</label>
        </div>
        <div className="station-metro-switch">
          <Switch id="count-in-enabled" checked={countInEnabled} disabled={captureLocked} onCheckedChange={onCountInChange} aria-describedby="count-in-help" />
          <label htmlFor="count-in-enabled">{ko.countInEnabled}</label>
        </div>
        <Text as="p" id="count-in-help" size="1" color="gray" mb="3">{captureLocked ? ko.countInLocked : ko.countInHelp}</Text>
        <Text as="p" id="metronome-volume-label" size="2">{ko.metronomeVolume} · {volume}%</Text>
        <Slider aria-labelledby="metronome-volume-label" min={0} max={100} step={1} value={[volume]}
          disabled={!ready} onValueChange={(values) => onVolumeChange(values[0] ?? 0)} />
        <Text as="p" size="2" color="gray" mt="2">{ready ? ko.metronomeBehavior : ko.transportNeedsAudio}</Text>
      </Popover.Content>
    </Popover.Root>
  );
}
