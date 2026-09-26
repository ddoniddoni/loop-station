"use client";

import { Button, Slider, Text } from "@radix-ui/themes";
import type { MicrophoneController, MicrophoneSnapshot } from "@/audio/input/microphone-controller";
import type { InputMeterSnapshot } from "@/audio/input/input-meter";
import { ko } from "@/lib/i18n/ko";
import { InputMonitorControls } from "./input-monitor-controls";

function decibels(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
}

function levelLabel(amplitude: number): string {
  return amplitude > 0 ? `${decibels(amplitude).toFixed(1)} dBFS` : "−∞ dBFS";
}

function InputMeter({ meter, enabled, onClearClip }: { meter: InputMeterSnapshot | null; enabled: boolean; onClearClip: () => void }) {
  const measured = meter?.receiving === true;
  const peakLabel = measured ? levelLabel(meter.peak) : "—";
  const rmsLabel = measured ? levelLabel(meter.rms) : "—";

  return (
    <div className="station-input-meter" data-clipped={meter?.clipped ?? false}>
      <div className="station-input-heading">
        <Text as="span" size="2" id="input-level-label">{ko.inputLevel}</Text>
        <span className="station-input-number">{peakLabel}</span>
      </div>
      {measured ? (
        <meter min={-60} max={0} low={-12} high={-3} optimum={-18}
          value={Math.max(-60, Math.min(0, decibels(meter.peak)))}
          aria-labelledby="input-level-label" aria-valuetext={peakLabel} />
      ) : (
        <div className="station-input-meter-empty"><Text as="span" size="1">{ko.inputMeterWaiting}</Text></div>
      )}
      <div className="station-input-meter-scale" aria-hidden="true"><span>−60</span><span>−40</span><span>−20</span><span>0 dB</span></div>
      <Text as="p" size="1" color="gray">{ko.inputRms}: {rmsLabel}</Text>
      <div className="station-input-clip">
        <Text as="p" size="1" role="status" color={meter?.clipped ? "red" : "gray"}>
          {meter?.clipped ? ko.inputClipped : ko.inputMeterHint}
        </Text>
        {meter?.clipped && <Button type="button" variant="soft" color="gray" disabled={!enabled} onClick={onClearClip}>{ko.inputClearClip}</Button>}
      </div>
    </div>
  );
}

export function MicrophoneInputControls({ controller, snapshot }: {
  controller: MicrophoneController;
  snapshot: MicrophoneSnapshot;
}) {
  const ready = snapshot.audioReady && snapshot.routed && snapshot.phase === "active";
  const gainLabel = `${snapshot.gainDb > 0 ? "+" : ""}${snapshot.gainDb} dB`;

  return (
    <div className="station-input-controls">
      {!ready && <Text as="p" id="input-controls-reason" size="2" color="gray">{
        !snapshot.audioReady ? ko.inputNeedsAudio : snapshot.issue === "routing-failed" ? ko.inputRoutingHint : snapshot.phase === "switching" ? ko.microphoneSwitching : ko.inputNeedsMicrophone
      }</Text>}
      {snapshot.issue === "routing-failed" && snapshot.audioReady && (
        <Button type="button" variant="outline" onClick={() => controller.retryRouting()}>{ko.inputRetryRouting}</Button>
      )}
      <InputMeter meter={snapshot.audioReady && snapshot.routed ? snapshot.meter : null} enabled={ready} onClearClip={() => controller.clearClip()} />
      <div className="station-input-gain">
        <div className="station-input-heading">
          <Text as="span" size="2" id="input-gain-label">{ko.inputGain}</Text>
          <span className="station-input-number">{gainLabel}</span>
        </div>
        <Slider aria-labelledby="input-gain-label" aria-valuetext={gainLabel}
          aria-describedby={ready ? "input-gain-hint" : "input-controls-reason"}
          min={-24} max={24} step={1} value={[snapshot.gainDb]} disabled={!ready}
          onValueChange={(values) => controller.setGain(values[0] ?? 0)} />
        <Text as="p" id="input-gain-hint" size="1" color="gray">{ko.inputGainHint}</Text>
      </div>
      <InputMonitorControls controller={controller} snapshot={snapshot} ready={ready} />
    </div>
  );
}
