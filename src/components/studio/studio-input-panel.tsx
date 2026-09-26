"use client";

import { Button, Heading } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useMicrophoneController } from "@/components/audio/audio-engine-provider";
import { useStudioView } from "./studio-view-provider";
import { StudioIcon } from "@/components/ui/studio-icon";

export function StudioInputPanel() {
  const { setInputOpen } = useStudioView();
  const controller = useMicrophoneController();
  const input = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const peak = input.meter?.receiving ? input.meter.peak : null;
  const db = peak === null ? null : peak > 0 ? 20 * Math.log10(peak) : -60;
  return (
    <section className="station-inspector-section station-input-panel" aria-labelledby="input-routing-title">
      <Heading as="h3" id="input-routing-title" size="2">INPUT ROUTING &amp; PREAMP</Heading>
      <div className="station-preamp">
        <div className="station-preamp-device"><span>Input Device</span><strong title={input.info?.label}>{input.info?.label || "마이크 미연결"}</strong></div>
        <div className="station-preamp-controls">
          <span className="station-knob" aria-hidden="true" style={{transform: `rotate(${input.gainDb * 4}deg)`}} />
          <div><span>GAIN</span><strong>{input.gainDb > 0 ? "+" : ""}{input.gainDb.toFixed(1)} dB</strong></div>
          <div className="station-preamp-monitor"><span>MONITOR</span><strong data-active={input.monitorEnabled}>{input.monitorEnabled ? "ON" : "OFF"}</strong></div>
        </div>
        {db !== null && <meter min={-60} max={0} value={Math.max(-60, Math.min(0, db))} aria-label="마이크 입력 피크" />}
        <Button variant="outline" color="gray" className="station-input-open" onClick={() => setInputOpen(true)}><StudioIcon name="settings" size={15} />입력 설정</Button>
      </div>
    </section>
  );
}
