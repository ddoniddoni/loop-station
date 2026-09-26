"use client";

import { Select } from "@radix-ui/themes";
import type { LoopSnapshot } from "@/audio/loop/loop-controller";
import { RECORD_LENGTHS } from "@/audio/loop/loop-protocol";
import { useLoopController } from "@/components/audio/audio-engine-provider";
import { trackIsEditing } from "./track-availability";

export function RecordingLength({ trackId, snapshot }: { trackId: number; snapshot: LoopSnapshot }) {
  const controller = useLoopController(trackId);
  const disabled = snapshot.hasClip || trackIsEditing(snapshot);
  const hint = snapshot.hasClip ? "길이 변경은 루프를 비운 뒤 가능합니다. 비운 루프는 복구할 수 있습니다."
    : disabled ? "녹음·편집·저장이 끝나면 길이를 선택할 수 있습니다."
      : "다음 마디부터 선택한 길이만큼 녹음합니다.";
  return <div className="station-recording-length">
    <div className="station-recording-length-field">
      <label htmlFor={`record-length-${trackId}`}>녹음 길이</label>
      <Select.Root value={String(snapshot.recordBars)} disabled={disabled} onValueChange={(value) => controller.setRecordBars(Number(value))}>
        <Select.Trigger id={`record-length-${trackId}`} aria-label={`${trackId + 1}번 트랙 녹음 길이`} aria-describedby={`record-length-hint-${trackId}`} />
        <Select.Content position="popper">{RECORD_LENGTHS.map((bars) => <Select.Item key={bars} value={String(bars)}>{bars}마디</Select.Item>)}</Select.Content>
      </Select.Root>
    </div>
    <p id={`record-length-hint-${trackId}`} className="station-recording-hint">{hint}</p>
  </div>;
}
