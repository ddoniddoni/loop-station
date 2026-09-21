"use client";

import { Flex, Heading, Slider, Switch, Text } from "@radix-ui/themes";
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
    <section aria-labelledby="metronome-title" className="studio-subsection studio-metronome">
      <Heading as="h3" id="metronome-title" size="3" weight="medium">{ko.metronomeTitle}</Heading>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">{ko.metronomeDescription}</Text>
      <Flex align="center" gap="3" mt="4">
        <Switch id="metronome-enabled" checked={enabled ?? false} disabled={!ready} onCheckedChange={onEnabledChange} />
        <label htmlFor="metronome-enabled"><Text as="span" size="2">{ko.metronomeEnabled}</Text></label>
      </Flex>
      <div className="mt-5 max-w-xs">
        <Text as="p" id="metronome-volume-label" size="2" mb="2">{ko.metronomeVolume}: {volume}%</Text>
        <Slider aria-labelledby="metronome-volume-label" min={0} max={100} step={1} value={[volume]}
          disabled={!ready} onValueChange={(values) => onVolumeChange(values[0] ?? 0)} />
      </div>
      <Text as="p" size="1" color="gray" mt="3">
        {ready ? ko.metronomeBehavior : ko.transportNeedsAudio}
      </Text>
    </section>
  );
}
