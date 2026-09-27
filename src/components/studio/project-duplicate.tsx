"use client";

import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { projectTitle, type ProjectSummary } from "@/audio/storage/project-catalog";
import { duplicateProjectTitle } from "@/audio/storage/project-duplication";
import { useAudioSessionContext, useProjectManager, useStationController } from "@/components/audio/audio-engine-provider";
import { useStudioView } from "./studio-view-provider";

function DuplicateForm({ source, onDone }: { source: ProjectSummary; onDone: () => void }) {
  const fieldId = useId();
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const audio = useAudioSessionContext();
  const router = useRouter();
  const { setView } = useStudioView();
  const [title, setTitle] = useState(() => duplicateProjectTitle(source.title));
  const [issue, setIssue] = useState<string | null>(null);
  const busy = state.operation !== null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssue(null);
    try {
      if (!await manager.duplicate(source, projectTitle(title), audio.stopAudio)) {
        setIssue(manager.getSnapshot().issue ?? "현재 작업을 마친 뒤 다시 시도하세요.");
        return;
      }
      onDone();
      setView("studio");
      router.push("/");
    } catch (error) { setIssue(error instanceof Error ? error.message : "프로젝트를 복제하지 못했습니다."); }
  }
  return <form className="station-project-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
    <label htmlFor={fieldId}>사본 이름<TextField.Root id={fieldId} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required disabled={busy} /></label>
    <Text as="p" size="2" color="gray">저장된 녹음·템포·믹서 설정과 Undo/Redo·비운 루프 복구 이력을 함께 복사합니다. 원본은 그대로 남습니다.</Text>
    {issue && <Text as="p" role="alert" size="2" color="red">{issue}</Text>}
    <Flex gap="2" justify="end">
      <Dialog.Close><Button type="button" variant="soft" color="gray" disabled={busy}>취소</Button></Dialog.Close>
      <Button type="submit" disabled={busy}>{busy ? "복제 중…" : "복제하고 스튜디오 열기"}</Button>
    </Flex>
  </form>;
}

export function ProjectDuplicate({ project }: { project: ProjectSummary }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(project);
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const station = useStationController();
  useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const reason = station.projectChangeReason;
  const disabled = state.phase !== "ready" || state.operation !== null || reason !== null;
  return <Dialog.Root open={open} onOpenChange={(value) => {
    if (state.operation) return;
    if (value) setSource(project);
    setOpen(value);
  }}>
    <Dialog.Trigger><Button variant="outline" disabled={disabled} title={reason ?? undefined} aria-label={`${project.title} 복제`}>복제</Button></Dialog.Trigger>
    <Dialog.Content className="station-overlay" maxWidth="440px">
      <Dialog.Title>프로젝트 복제</Dialog.Title>
      <Dialog.Description size="2">{source.title}의 마지막 저장본으로 독립된 사본을 만듭니다. 현재 오디오와 마이크 연결은 종료되며, 사본의 재생은 직접 시작해야 합니다.</Dialog.Description>
      <DuplicateForm source={source} onDone={() => setOpen(false)} />
    </Dialog.Content>
  </Dialog.Root>;
}
