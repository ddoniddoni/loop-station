"use client";

import { Button, Flex, Heading, Select, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import type { MicrophoneDevice, MicrophoneInfo } from "@/audio/input/microphone-session";
import type { MicrophonePhase } from "@/audio/input/microphone-controller";
import { useMicrophoneController } from "@/components/audio/audio-engine-provider";
import { MicrophoneInputControls } from "@/components/audio/microphone-input-controls";
import { ko } from "@/lib/i18n/ko";

const phaseStatus: Record<MicrophonePhase, string> = {
  idle: ko.microphoneIdle,
  requesting: ko.microphoneRequesting,
  switching: ko.microphoneSwitching,
  active: ko.microphoneActive,
  error: ko.microphoneErrors.unknown,
  disconnected: ko.microphoneDisconnected,
  unavailable: ko.microphoneErrors.unsupported,
};

function setting(value: boolean | number | undefined): string {
  if (value === undefined) return ko.microphoneSettingUnknown;
  if (typeof value === "boolean") return value ? ko.microphoneSettingOn : ko.microphoneSettingOff;
  return String(value);
}

function InputSettings({ info }: { info: MicrophoneInfo }) {
  const { settings } = info;
  return (
    <div className="mt-4">
      <Text as="p" size="2" weight="medium">{ko.microphoneInputSettings}: {info.label || ko.microphoneUnnamedDevice}</Text>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>{ko.microphoneChannelCount}</dt><dd>{setting(settings.channelCount)}</dd>
        <dt>{ko.microphoneSampleRate}</dt><dd>{setting(settings.sampleRate)}{settings.sampleRate === undefined ? "" : " Hz"}</dd>
        <dt>{ko.microphoneEchoCancellation}</dt><dd>{setting(settings.echoCancellation)}</dd>
        <dt>{ko.microphoneNoiseSuppression}</dt><dd>{setting(settings.noiseSuppression)}</dd>
        <dt>{ko.microphoneAutoGainControl}</dt><dd>{setting(settings.autoGainControl)}</dd>
      </dl>
    </div>
  );
}

function DeviceSelect({ devices, info, disabled, onSelect }: {
  devices: MicrophoneDevice[];
  info: MicrophoneInfo;
  disabled: boolean;
  onSelect: (deviceId?: string) => void;
}) {
  const selectedId = devices.some((device) => device.id === info.deviceId && device.id !== "default")
    ? info.deviceId ?? "default"
    : "default";

  return (
    <div className="mt-4">
      <label htmlFor="microphone-device"><Text as="span" size="2">{ko.microphoneDevice}</Text></label>
      <div className="mt-2">
        <Select.Root value={selectedId} disabled={disabled} onValueChange={(value) => onSelect(value === "default" ? undefined : value)}>
          <Select.Trigger id="microphone-device" aria-label={ko.microphoneDevice} />
          <Select.Content position="popper">
            <Select.Item value="default">{ko.microphoneDefaultDevice}</Select.Item>
            {devices.filter((device) => device.id !== "default").map((device) => (
              <Select.Item key={device.id} value={device.id}>
                {device.label || ko.microphoneUnnamedDevice}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  );
}

function MicrophoneControls({ phase, onRequest, onCancel, onRelease }: {
  phase: MicrophonePhase;
  onRequest: () => void;
  onCancel: () => void;
  onRelease: () => void;
}) {
  return (
    <Flex gap="3" wrap="wrap" mt="4">
      {(phase === "idle" || phase === "error" || phase === "disconnected") && (
        <Button type="button" onClick={onRequest}>
          {phase === "idle" ? ko.microphoneStart : ko.microphoneRetry}
        </Button>
      )}
      {(phase === "requesting" || phase === "switching") && (
        <Button type="button" variant="outline" onClick={onCancel}>{ko.microphoneCancel}</Button>
      )}
      {(phase === "active" || phase === "switching") && (
        <Button type="button" variant="soft" color="gray" onClick={onRelease}>{ko.microphoneRelease}</Button>
      )}
    </Flex>
  );
}

function MicrophoneDetails({ phase, info, devices, listUnavailable, captureLocked, onSelect }: {
  phase: MicrophonePhase;
  info: MicrophoneInfo | null;
  devices: MicrophoneDevice[];
  listUnavailable: boolean;
  captureLocked: boolean;
  onSelect: (deviceId?: string) => void;
}) {
  if (!info || (phase !== "active" && phase !== "switching")) return null;

  return (
    <>
      {devices.length > 0 && <DeviceSelect devices={devices} info={info} disabled={phase === "switching" || captureLocked} onSelect={onSelect} />}
      {captureLocked && <Text as="p" size="2" color="gray" mt="2">녹음이 끝나거나 취소된 뒤 입력 장치를 변경할 수 있습니다.</Text>}
      {listUnavailable && <Text as="p" size="2" color="amber" mt="3">{ko.microphoneListUnavailable}</Text>}
      <InputSettings info={info} />
    </>
  );
}

export function MicrophoneSetup() {
  const controller = useMicrophoneController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const { phase, info, devices, listUnavailable } = snapshot;
  const issue = snapshot.issue === "routing-failed"
    ? ko.inputRoutingFailed
    : snapshot.issue ? ko.microphoneErrors[snapshot.issue] : null;

  return (
    <section aria-labelledby="microphone-title" className="studio-side-content">
      <Heading as="h3" id="microphone-title" size="3" weight="medium">{ko.microphoneTitle}</Heading>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">{ko.microphoneDescription}</Text>
      <MicrophoneControls
        phase={phase}
        onRequest={() => void controller.request()}
        onCancel={() => controller.cancelRequest()}
        onRelease={() => controller.release()}
      />
      <Text as="p" role={issue || phase === "disconnected" ? "alert" : "status"} size="2" color={issue ? "red" : "gray"} mt="3">
        {issue ?? phaseStatus[phase]}
      </Text>
      <MicrophoneInputControls controller={controller} snapshot={snapshot} />
      <MicrophoneDetails
        phase={phase}
        info={info}
        devices={devices}
        listUnavailable={listUnavailable}
        captureLocked={snapshot.captureLocked}
        onSelect={(id) => void controller.request(id)}
      />
    </section>
  );
}
