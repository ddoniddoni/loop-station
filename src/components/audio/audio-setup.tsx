"use client";

import { Button, Flex, Heading, Popover, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useAudioSessionContext, useLoopController } from "@/components/audio/audio-engine-provider";
import { isCapturePhase } from "@/audio/loop/loop-controller";
import type { AudioPhase } from "@/components/audio/use-audio-session";
import { MetronomeControls } from "@/components/audio/metronome-controls";
import { TransportControls } from "@/components/audio/transport-controls";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

const phaseStatus: Record<AudioPhase, string> = {
  idle: ko.audioIdle, starting: ko.audioStarting, ready: ko.audioReady,
  playing: ko.audioPlaying, suspended: ko.audioSuspended, stopping: ko.audioStopping,
  error: ko.audioErrors.startFailed,
};

function AudioPrimaryAction() {
  const audio = useAudioSessionContext();
  switch (audio.phase) {
    case "idle":
    case "error":
      return <Button onClick={() => void audio.startAudio()}><StudioIcon name="power" />{audio.phase === "error" ? ko.audioRetry : ko.audioStart}</Button>;
    case "ready": return <Button onClick={audio.startTone}>{ko.toneStart}</Button>;
    case "playing": return <Button variant="soft" onClick={audio.stopTone}>{ko.toneStop}</Button>;
    case "suspended": return <Button onClick={() => void audio.resumeAudio()}>{ko.audioResume}</Button>;
    default: return null;
  }
}

function AudioPowerActions() {
  const audio = useAudioSessionContext();
  const canStop = audio.phase !== "idle" && audio.phase !== "error";
  return <Flex gap="2" wrap="wrap" mt="4"><AudioPrimaryAction />{canStop && <Button variant="outline" color="gray" disabled={audio.phase === "stopping"} onClick={() => void audio.stopAudio()}>{audio.phase === "starting" ? ko.audioCancel : ko.audioEnd}</Button>}</Flex>;
}

function AudioPower() {
  const audio = useAudioSessionContext();
  const { phase, sampleRate, issue } = audio;
  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button type="button" variant="outline" color="gray" className="station-power" aria-label="오디오 연결 설정" data-ready={phase === "ready" || phase === "playing"}>
          <StudioIcon name="power" size={16} />
          <span>{sampleRate ? `${sampleRate / 1000}kHz` : "AUDIO"}<small>{phase === "ready" || phase === "playing" ? "ON" : phase === "idle" ? "OFF" : "설정"}</small></span>
        </Button>
      </Popover.Trigger>
      <Popover.Content className="station-overlay station-audio-popover" width="320" sideOffset={8}>
        <Heading as="h2" size="3">{ko.audioPanelTitle}</Heading>
        <Text as="p" size="2" color="gray" mt="2">{ko.audioPanelDescription}</Text>
        <AudioPowerActions />
        <Text as="p" size="2" mt="3" role={issue ? "alert" : "status"} color={issue ? "red" : "gray"}>{issue ?? phaseStatus[phase]}</Text>
      </Popover.Content>
    </Popover.Root>
  );
}

export function AudioSetup() {
  const audio = useAudioSessionContext();
  const loop = useLoopController();
  const loopState = useSyncExternalStore(loop.subscribe, loop.getSnapshot, loop.getServerSnapshot);
  const ready = audio.phase === "ready" || audio.phase === "playing";
  return (
    <div className="station-audio-console" aria-label={ko.studioControlTitle}>
      <TransportControls enabled={ready} settingsLocked={loopState.hasClip || isCapturePhase(loopState.phase)} snapshot={audio.transport} onStart={audio.startTransport}
        onStop={audio.stopTransport} onReset={audio.resetTransport} onConfigure={audio.configureTransport} />
      <MetronomeControls audioReady={ready} enabled={audio.metronomeEnabled} volume={audio.metronomeVolume}
        onEnabledChange={audio.setMetronomeEnabled} onVolumeChange={audio.setMetronomeVolume} />
      <AudioPower />
      <Button type="button" className="station-panic" variant="outline" color="red" disabled={audio.phase === "idle" || audio.phase === "error" || audio.phase === "stopping"}
        aria-label="모든 오디오 종료 (PANIC)" onClick={() => void audio.stopAudio()}><StudioIcon name="stop" size={14} /><span>PANIC</span></Button>
      {audio.issue && <Text as="p" size="1" role="alert" className="station-audio-issue">{audio.issue}</Text>}
    </div>
  );
}
