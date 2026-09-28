"use client";

import { Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import { useState, useSyncExternalStore } from "react";
import type { ProjectSummary } from "@/audio/storage/project-catalog";
import { useAudioSessionContext, useProjectManager, useStationController } from "@/components/audio/audio-engine-provider";

export function ProjectTrash({ project }: { project: ProjectSummary }) {
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const station = useStationController();
  useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const audio = useAudioSessionContext();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(project);
  const [issue, setIssue] = useState<string | null>(null);
  const reason = station.projectChangeReason;
  const busy = state.operation !== null;
  async function move() {
    setIssue(null);
    if (await manager.trash(source, audio.stopAudio)) setOpen(false);
    else setIssue(manager.getSnapshot().issue ?? "현재 작업을 마친 뒤 다시 시도하세요.");
  }
  return <Dialog.Root open={open} onOpenChange={(value) => {
    if (busy) return;
    if (value) { setSource(project); setIssue(null); }
    setOpen(value);
  }}>
    <Dialog.Trigger><Button variant="soft" color="gray" disabled={state.phase !== "ready" || busy || reason !== null}
      title={reason ?? undefined} aria-label={`${project.title} 휴지통으로 이동`}>휴지통으로 이동</Button></Dialog.Trigger>
    <Dialog.Content className="station-overlay" maxWidth="440px">
      <Dialog.Title>휴지통으로 옮길까요?</Dialog.Title>
      <Dialog.Description size="2">{source.title}의 녹음·믹서 설정과 되돌리기 이력을 보존합니다. 휴지통에서 다시 복구할 수 있습니다.</Dialog.Description>
      <Text as="p" size="2" color="gray" mt="3">현재 열린 프로젝트라면 오디오와 마이크를 종료하고 빈 작업으로 돌아갑니다. 다른 프로젝트를 자동으로 재생하지 않습니다.</Text>
      {issue && <Text as="p" role="alert" color="red" size="2" mt="3">{issue}</Text>}
      <Flex gap="2" justify="end" mt="4">
        <Dialog.Close><Button variant="soft" color="gray" disabled={busy}>취소</Button></Dialog.Close>
        <Button disabled={busy || reason !== null} onClick={() => void move()}>{busy ? "옮기는 중…" : "휴지통으로 옮기기"}</Button>
      </Flex>
    </Dialog.Content>
  </Dialog.Root>;
}

export function ProjectTrashList() {
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const station = useStationController();
  useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const reason = station.projectChangeReason;
  return <>
    <Text as="p" size="2" color="gray" my="3">녹음은 그대로 보관됩니다. 자동 삭제나 영구 삭제는 하지 않으며, 휴지통으로 옮겨도 저장 공간은 줄어들지 않습니다.</Text>
    {state.trashed.length === 0 && <Text as="p" className="station-projects-empty">휴지통이 비어 있습니다.</Text>}
    <div className="station-project-trash-list">
      {state.trashed.map((project) => <article key={project.id} className="station-project-trash-row" aria-label={`${project.title} 휴지통 항목`}>
        <div>
          <Heading as="h2" size="4">{project.title}</Heading>
          <Text as="p" size="2" color="gray" mt="2">{project.clipCount}개 트랙 · 이동 {project.updatedAtLabel}</Text>
          {state.projects.some((item) => item.title === project.title) && <Text as="p" size="1" mt="2">같은 이름의 프로젝트가 있습니다. 덮어쓰지 않고 별도 프로젝트로 복구합니다.</Text>}
        </div>
        <Button variant="outline" disabled={state.operation !== null || reason !== null} title={reason ?? undefined}
          aria-label={`${project.title} 복구`} onClick={() => void manager.restore(project)}>복구</Button>
      </article>)}
    </div>
  </>;
}
