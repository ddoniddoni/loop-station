"use client";

import { Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useMicrophoneController } from "@/components/audio/audio-engine-provider";
import { MicrophoneSetup } from "@/components/audio/microphone-setup";
import { StudioIcon } from "@/components/ui/studio-icon";

export function StudioInputPanel() {
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
          <div className="station-preamp-monitor"><span>MONITOR</span><strong data-active={input.monitorMode !== "off"}>{input.monitorPending ? "…" : input.monitorMode.toUpperCase()}</strong></div>
        </div>
        {db !== null && <meter min={-60} max={0} value={Math.max(-60, Math.min(0, db))} aria-label="마이크 입력 피크" />}
        <Dialog.Root>
          <Dialog.Trigger><Button variant="outline" color="gray" className="station-input-open"><StudioIcon name="settings" size={15} />입력 설정</Button></Dialog.Trigger>
          <Dialog.Content maxWidth="520px" className="station-overlay station-input-dialog">
            <Flex align="center" justify="between" gap="3">
              <Dialog.Title mb="0">입력 장치와 모니터링</Dialog.Title>
              <Dialog.Close><Button variant="soft" color="gray" aria-label="입력 설정 닫기">닫기</Button></Dialog.Close>
            </Flex>
            <Dialog.Description size="2" mt="2" mb="4">마이크 연결, 입력 게인과 내 소리 듣기를 조절합니다.</Dialog.Description>
            <MicrophoneSetup />
            <Text as="p" size="1" color="gray" mt="4">이 창을 닫아도 연결은 유지됩니다. 연결을 끊으려면 마이크 해제를 누르세요.</Text>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </section>
  );
}
