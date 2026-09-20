"use client";

import { Button, Flex, Heading, Select, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import {
  MicrophoneError,
  MicrophoneSession,
  type MicrophoneDevice,
  type MicrophoneInfo,
} from "@/audio/input/microphone-session";
import { ko } from "@/lib/i18n/ko";

type MicrophonePhase = "idle" | "requesting" | "switching" | "active" | "error" | "disconnected" | "unavailable";

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

function MicrophoneDetails({ phase, info, devices, listUnavailable, onSelect }: {
  phase: MicrophonePhase;
  info: MicrophoneInfo | null;
  devices: MicrophoneDevice[];
  listUnavailable: boolean;
  onSelect: (deviceId?: string) => void;
}) {
  if (!info || (phase !== "active" && phase !== "switching")) return null;

  return (
    <>
      {devices.length > 0 && <DeviceSelect devices={devices} info={info} disabled={phase === "switching"} onSelect={onSelect} />}
      {listUnavailable && <Text as="p" size="2" color="amber" mt="3">{ko.microphoneListUnavailable}</Text>}
      <InputSettings info={info} />
    </>
  );
}

export function MicrophoneSetup() {
  const sessionRef = useRef<MicrophoneSession | null>(null);
  const [phase, setPhase] = useState<MicrophonePhase>("idle");
  const [info, setInfo] = useState<MicrophoneInfo | null>(null);
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  const [issue, setIssue] = useState<string | null>(null);
  const [listUnavailable, setListUnavailable] = useState(false);

  useEffect(() => () => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
  }, []);

  function getSession(): MicrophoneSession | null {
    if (sessionRef.current) return sessionRef.current;

    let session: MicrophoneSession;
    try {
      session = new MicrophoneSession({
        onDisconnected: () => {
          if (sessionRef.current !== session) return;
          session.cancelPending();
          setInfo(null);
          setDevices([]);
          setPhase("disconnected");
          setIssue(null);
        },
        onDevicesChanged: (available) => {
          if (sessionRef.current !== session) return;
          setDevices(available);
          setListUnavailable(false);
        },
        onDeviceListError: () => {
          if (sessionRef.current !== session) return;
          setDevices([]);
          setListUnavailable(true);
        },
      });
    } catch (error) {
      setPhase(isUnavailable(error) ? "unavailable" : "error");
      setIssue(microphoneErrorMessage(error));
      return null;
    }

    sessionRef.current = session;
    return session;
  }

  async function requestMicrophone(deviceId?: string): Promise<void> {
    const session = getSession();
    if (!session) return;
    const wasActive = session.active;
    setPhase(wasActive ? "switching" : "requesting");
    setIssue(null);

    try {
      const nextInfo = await session.request(deviceId);
      if (sessionRef.current !== session) return;
      setInfo(nextInfo);
      setPhase("active");
    } catch (error) {
      if (sessionRef.current !== session || isCancelled(error)) return;
      setPhase(session.active ? "active" : "error");
      setIssue(microphoneErrorMessage(error));
    }
  }

  function cancelRequest(): void {
    const session = sessionRef.current;
    const wasActive = session?.active ?? false;
    session?.cancelPending();
    setPhase(wasActive ? "active" : "idle");
    setIssue(wasActive ? null : ko.microphoneCancelled);
  }

  function releaseMicrophone(): void {
    sessionRef.current?.release();
    setInfo(null);
    setDevices([]);
    setListUnavailable(false);
    setIssue(null);
    setPhase("idle");
  }

  return (
    <section aria-labelledby="microphone-title" className="mt-8 border-t border-[var(--gray-a6)] pt-6">
      <Heading as="h3" id="microphone-title" size="3" weight="medium">{ko.microphoneTitle}</Heading>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">{ko.microphoneDescription}</Text>
      <MicrophoneControls
        phase={phase}
        onRequest={() => void requestMicrophone()}
        onCancel={cancelRequest}
        onRelease={releaseMicrophone}
      />
      <Text as="p" role={issue || phase === "disconnected" ? "alert" : "status"} size="2" color={issue ? "red" : "gray"} mt="3">
        {issue ?? phaseStatus[phase]}
      </Text>
      <MicrophoneDetails
        phase={phase}
        info={info}
        devices={devices}
        listUnavailable={listUnavailable}
        onSelect={(id) => void requestMicrophone(id)}
      />
    </section>
  );
}

function isCancelled(error: unknown): boolean {
  return error instanceof MicrophoneError && error.code === "cancelled";
}

function isUnavailable(error: unknown): boolean {
  return error instanceof MicrophoneError && (error.code === "insecure-context" || error.code === "unsupported");
}

function microphoneErrorMessage(error: unknown): string {
  return error instanceof MicrophoneError ? ko.microphoneErrors[error.code] : ko.microphoneErrors.unknown;
}
