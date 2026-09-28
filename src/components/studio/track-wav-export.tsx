"use client";

import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { TrackWavExporter } from "@/audio/export/track-wav-exporter";
import { useLoopController, useProjectManager, useStationController } from "@/components/audio/audio-engine-provider";

function ExportDialog({ trackId, title }: { trackId: number; title: string }) {
  const station = useStationController();
  const track = useLoopController(trackId);
  const clip = useSyncExternalStore(track.subscribe, track.getSnapshot, track.getServerSnapshot);
  useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const [exporter] = useState(() => new TrackWavExporter(station));
  const state = useSyncExternalStore(exporter.subscribe, exporter.getSnapshot, exporter.getServerSnapshot);
  const [open, setOpen] = useState(false);
  const hintId = useId();
  useEffect(() => () => { exporter.cancel(); }, [exporter]);
  const reason = !clip.hasClip ? "녹음된 루프가 있어야 내보낼 수 있습니다."
    : !clip.metadata?.complete ? "완료된 루프만 내보낼 수 있습니다." : station.projectChangeReason;
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) exporter.cancel(); setOpen(value); }}>
    <Flex direction="column" gap="2" mt="3">
      <Dialog.Trigger><Button variant="outline" disabled={!!reason} aria-describedby={hintId}>선택 트랙 WAV 내보내기</Button></Dialog.Trigger>
      <Text as="p" id={hintId} size="1" color="gray">{reason ?? "한 바퀴 원본 녹음 · 모노 · 24bit WAV"}</Text>
    </Flex>
    <Dialog.Content className="station-overlay" maxWidth="480px">
      <Dialog.Title>트랙 {String(trackId + 1).padStart(2, "0")} WAV 내보내기</Dialog.Title>
      <Dialog.Description size="2">선택한 트랙의 마지막 저장된 녹음 한 바퀴를 파일로 준비합니다.</Dialog.Description>
      <Flex direction="column" gap="3" mt="4">
        <Text as="p" size="2">{clip.metadata?.sampleRate.toLocaleString()} Hz · 모노 · PCM 24bit · {clip.metadata ? (clip.metadata.frames / clip.metadata.sampleRate).toFixed(2) : "0"}초</Text>
        <Text as="p" size="2" color="gray">오버더빙을 포함한 원본 녹음입니다. 믹서 볼륨·팬·Mute·Solo·마스터는 적용하지 않으며 클릭도 포함하지 않습니다. 정규화와 디더는 끈 상태입니다.</Text>
        <Text as="p" size="2" color="gray">파일을 준비한 뒤 다운로드를 눌러주세요. 창을 닫으면 편집을 계속할 수 있습니다. 실제 파일 저장 여부는 브라우저 다운로드 목록에서 확인하세요.</Text>
        {state.phase === "encoding" && <div role="status"><Text as="p" size="2">WAV 준비 중 · {Math.round(state.progress * 100)}%</Text><progress aria-label="WAV 준비 진행률" value={state.progress} max={1} style={{ width: "100%" }} /></div>}
        {state.issue && <Text as="p" size="2" color="red" role="alert">{state.issue}</Text>}
        {state.phase === "ready" && <Text as="p" size="2" role="status" style={{ overflowWrap: "anywhere" }}>다운로드 준비 완료 · {state.filename}</Text>}
        {state.clipped > 0 && <Text as="p" size="2" color="amber">범위를 넘은 {state.clipped.toLocaleString()}개 샘플은 WAV 파일에서 최대 음량으로 제한됩니다. 원본 녹음은 유지됩니다.</Text>}
        <Flex gap="2" justify="end" wrap="wrap">
          <Dialog.Close><Button variant="soft" color="gray">{state.phase === "encoding" ? "준비 취소" : "닫기"}</Button></Dialog.Close>
          {state.phase === "ready" && state.url ? <Button asChild><a href={state.url} download={state.filename}>WAV 다운로드</a></Button>
            : <Button disabled={state.phase === "encoding" || !!reason} onClick={() => exporter.start(trackId, title)}>{state.phase === "error" ? "다시 준비" : "WAV 파일 준비"}</Button>}
        </Flex>
      </Flex>
    </Dialog.Content>
  </Dialog.Root>;
}

export function TrackWavExport({ trackId }: { trackId: number }) {
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const title = state.projects.find((project) => project.id === state.activeId)?.title ?? "로컬 프로젝트";
  return <ExportDialog key={`${state.activeId}-${trackId}`} trackId={trackId} title={title} />;
}
