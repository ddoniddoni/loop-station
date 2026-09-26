"use client";

import { Button, Flex, Select, Text } from "@radix-ui/themes";
import type { LoopSnapshot } from "@/audio/loop/loop-controller";
import { isPlaybackTiming, PLAYBACK_TIMINGS, type PlaybackAction } from "@/audio/loop/playback-scheduling";
import { useLoopController } from "@/components/audio/audio-engine-provider";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";
import { trackIsEditing, workspaceBlocksTrack } from "./track-availability";

export function LoopPlaybackButton({ snapshot, trackId }: { snapshot: LoopSnapshot; trackId: number }) {
  const controller = useLoopController(trackId);
  const pending = snapshot.pendingPlayback;
  if (pending) return <Button className="station-track-action" variant="outline" color="amber"
    disabled={!snapshot.connected || snapshot.playbackSending} onClick={() => controller.cancelPlayback()}>
    {pending.action === "play" ? ko.playbackCancelPlay : ko.playbackCancelStop}
  </Button>;
  const playing = snapshot.phase === "playing";
  const disabled = !snapshot.connected || !snapshot.metadata?.complete || snapshot.playbackSending
    || snapshot.historyPending !== null || (!playing && workspaceBlocksTrack(snapshot));
  return <Button className="station-track-action" variant="outline" disabled={disabled}
    onClick={() => playing ? controller.stopPlayback() : controller.play()}>
    <StudioIcon name={playing ? "stop" : "play"} size={16} />{playing ? "반복 정지" : "반복 재생"}
  </Button>;
}

function TimingSelect({ action, trackId, snapshot }: { action: PlaybackAction; trackId: number; snapshot: LoopSnapshot }) {
  const controller = useLoopController(trackId);
  const label = action === "play" ? ko.playbackStartTiming : ko.playbackStopTiming;
  const value = action === "play" ? snapshot.playTiming : snapshot.stopTiming;
  const disabled = !snapshot.metadata?.complete || trackIsEditing(snapshot);
  return <Flex align="center" justify="between" gap="2" wrap="wrap">
    <label htmlFor={`playback-${action}-${trackId}`}><Text size="1">{label}</Text></label>
    <Select.Root value={value} disabled={disabled} onValueChange={(next) => { if (isPlaybackTiming(next)) controller.setPlaybackTiming(action, next); }}>
      <Select.Trigger id={`playback-${action}-${trackId}`} aria-label={`${trackId + 1}번 트랙 ${label}`} aria-describedby={`playback-help-${trackId}`} />
      <Select.Content position="popper">{PLAYBACK_TIMINGS.map((timing) => <Select.Item key={timing} value={timing}>{ko.playbackTimings[timing]}</Select.Item>)}</Select.Content>
    </Select.Root>
  </Flex>;
}

export function PlaybackTimingControls({ snapshot, trackId }: { snapshot: LoopSnapshot; trackId: number }) {
  if (!snapshot.hasClip) return null;
  return <Flex direction="column" gap="2" my="2">
    <TimingSelect action="play" trackId={trackId} snapshot={snapshot} />
    <TimingSelect action="stop" trackId={trackId} snapshot={snapshot} />
    <Text as="p" size="1" color="gray" id={`playback-help-${trackId}`}>
      {!snapshot.metadata?.complete ? ko.playbackIncomplete : trackIsEditing(snapshot) ? ko.playbackTimingLocked : ko.playbackTimingHelp}
    </Text>
  </Flex>;
}
