"use client";

import { Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useStationController } from "@/components/audio/audio-engine-provider";
import { ko } from "@/lib/i18n/ko";

function decibels(amplitude: number): number { return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity; }
function label(amplitude: number): string { return amplitude > 0 ? `${decibels(amplitude).toFixed(1)}` : "−∞"; }

export function OutputLevelMeter({ channel, name }: { channel: number | "left" | "right"; name: string }) {
  const { meters } = useStationController();
  const snapshot = useSyncExternalStore(meters.subscribe, meters.getSnapshot, meters.getServerSnapshot);
  const reading = typeof channel === "number" ? snapshot?.tracks[channel] : snapshot?.[channel];
  return <div className="station-output-meter" data-clipped={reading?.clipped ?? false} data-measured={!!reading}>
    {reading ? <meter min={-60} max={0} low={-12} high={-3} optimum={-18}
      value={Math.max(-60, Math.min(0, decibels(reading.peak)))} aria-label={`${name} ${ko.mixerPeak}`}
      aria-valuetext={`${label(reading.peak)} dBFS`} /> : <div className="station-output-meter-empty">{ko.mixerUnmeasured}</div>}
    <Text as="p">{name} <span>{reading ? `${label(reading.peak)} dBFS` : "—"}</span></Text>
    <Text as="p">RMS <span>{reading ? label(reading.rms) : "—"}</span></Text>
    <Text as="p">HOLD <span>{reading ? label(reading.hold) : "—"}</span></Text>
    <Text as="p" className="station-output-overload">{reading?.clipped ? (typeof channel === "number" ? ko.mixerTrackOverload : ko.mixerOutputClipped) : "\u00a0"}</Text>
  </div>;
}
