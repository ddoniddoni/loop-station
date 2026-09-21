"use client";

import { Badge, Heading, Slider, Switch, Text } from "@radix-ui/themes";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

type MetronomeControlsProps = {
  audioReady: boolean;
  enabled: boolean | null;
  volume: number;
  onEnabledChange: (enabled: boolean) => void;
  onVolumeChange: (volume: number) => void;
};

export function MetronomeControls({ audioReady, enabled, volume, onEnabledChange, onVolumeChange }: MetronomeControlsProps) {
  const ready = audioReady && enabled !== null;

  return (
    <section aria-labelledby="metronome-title" className="station-metronome">
      <div className="station-metro-heading">
        <Heading as="h2" id="metronome-title" size="3">{ko.metronomeTitle}</Heading>
        <Badge variant="soft" color={enabled ? "jade" : "gray"}>{enabled ? ko.microphoneSettingOn : ko.microphoneSettingOff}</Badge>
      </div>
      <div className="station-metro-switch">
        <Switch id="metronome-enabled" size="3" checked={enabled ?? false} disabled={!ready} onCheckedChange={onEnabledChange} />
        <label htmlFor="metronome-enabled"><Text as="span" size="2">{ko.metronomeEnabled}</Text></label>
      </div>
      <div className="station-metro-volume">
        <Text as="p" id="metronome-volume-label" size="2">{ko.metronomeVolume}<span>{volume}%</span></Text>
        <Slider aria-labelledby="metronome-volume-label" min={0} max={100} step={1} value={[volume]}
          disabled={!ready} onValueChange={(values) => onVolumeChange(values[0] ?? 0)} />
      </div>
      <details className="station-help">
        <summary><StudioIcon name="info" size={16} />{ko.metronomeHelp}</summary>
        <Text as="p" size="2" color="gray">{ready ? ko.metronomeBehavior : ko.transportNeedsAudio}</Text>
      </details>
    </section>
  );
}
