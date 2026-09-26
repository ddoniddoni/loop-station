"use client";

import { Badge, Button, Slider, Switch, Text } from "@radix-ui/themes";
import type { MicrophoneController, MicrophoneSnapshot } from "@/audio/input/microphone-controller";
import type { InputMeterSnapshot } from "@/audio/input/input-meter";
import { ko } from "@/lib/i18n/ko";

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

function inputControlsReason(snapshot: MicrophoneSnapshot): string {
  if (!snapshot.audioReady) return ko.inputNeedsAudio;
  if (snapshot.issue === "routing-failed") return ko.inputRoutingHint;
  if (snapshot.phase === "applying") return ko.inputProcessingApplying;
  if (snapshot.phase === "switching") return ko.microphoneSwitching;
  return ko.inputNeedsMicrophone;
}

export function MicrophoneInputControls({ controller, snapshot }: {
  controller: MicrophoneController;
  snapshot: MicrophoneSnapshot;
}) {
  const ready = snapshot.audioReady && snapshot.routed && snapshot.phase === "active";
  const gainLabel = `${snapshot.gainDb > 0 ? "+" : ""}${snapshot.gainDb} dB`;

  return (
    <div className="station-input-controls">
      {!ready && <Text as="p" id="input-controls-reason" size="2" color="gray">{inputControlsReason(snapshot)}</Text>}
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
      <div className="station-input-monitor">
        <div className="station-input-heading">
          <label htmlFor="input-monitor-enabled"><Text as="span" size="2">{ko.inputMonitor}</Text></label>
          <Badge color={snapshot.monitorEnabled ? "jade" : "gray"} variant="soft">{snapshot.monitorEnabled ? ko.microphoneSettingOn : ko.microphoneSettingOff}</Badge>
          <Switch id="input-monitor-enabled" size="3" checked={snapshot.monitorEnabled} disabled={!ready}
            aria-describedby="input-monitor-hint" onCheckedChange={(enabled) => controller.setMonitor(enabled)} />
        </div>
        <Text as="p" id="input-monitor-hint" size="1" color="gray">{ko.inputMonitorHint}</Text>
        <div className="station-input-heading">
          <Text as="span" id="input-monitor-volume-label" size="2">{ko.inputMonitorVolume}</Text>
          <span className="station-input-number">{snapshot.monitorVolume}%</span>
        </div>
        <Slider aria-labelledby="input-monitor-volume-label" aria-valuetext={`${snapshot.monitorVolume}%`}
          min={0} max={100} step={1} value={[snapshot.monitorVolume]} disabled={!ready}
          onValueChange={(values) => controller.setMonitorVolume(values[0] ?? 20)} />
        <Text as="p" size="1" color="gray">{ko.inputMonitorResetHint}</Text>
      </div>
    </div>
  );
}
