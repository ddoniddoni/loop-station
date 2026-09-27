"use client";

import { Button, Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { projectTitle, type ProjectSummary } from "@/audio/storage/project-catalog";
import { TRANSPORT_METERS } from "@/audio/transport/audio-frame-clock";
import { useAudioSessionContext, useProjectManager, useStationController } from "@/components/audio/audio-engine-provider";
import { useStudioView } from "./studio-view-provider";

function ProjectForm({ project, onDone }: { project?: ProjectSummary; onDone: () => void }) {
  const fieldId = useId();
  const manager = useProjectManager();
  const audio = useAudioSessionContext();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const router = useRouter();
  const { setView } = useStudioView();
  const [title, setTitle] = useState(project?.title ?? "");
  const [bpm, setBpm] = useState("120");
  const [meter, setMeter] = useState("4/4");
  const [issue, setIssue] = useState<string | null>(null);
  const busy = state.operation !== null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssue(null);
    try {
      const name = projectTitle(title);
      const signature = TRANSPORT_METERS.find((item) => item.label === meter);
      if (!signature || !Number.isInteger(Number(bpm)) || Number(bpm) < 40 || Number(bpm) > 240) throw new Error("BPM은 40~240 사이의 정수로 입력하세요.");
      const succeeded = project ? await manager.rename(project, name)
        : await manager.create(name, { bpm: Number(bpm), numerator: signature.numerator, denominator: signature.denominator }, audio.stopAudio);
      if (!succeeded) { setIssue(manager.getSnapshot().issue ?? "현재 작업을 마친 뒤 다시 시도하세요."); return; }
      onDone();
      if (!project) { setView("studio"); router.push("/"); }
    } catch (error) { setIssue(error instanceof Error ? error.message : "프로젝트를 저장하지 못했습니다."); }
  }
  return <form onSubmit={(event) => void submit(event)} className="station-project-form">
    <label htmlFor={`${fieldId}-title`}>프로젝트 이름<TextField.Root id={`${fieldId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required disabled={busy} placeholder="예: 주말 비트 연습" /></label>
    {!project && <Flex gap="3" wrap="wrap">
      <label htmlFor={`${fieldId}-bpm`}>BPM<TextField.Root id={`${fieldId}-bpm`} type="number" min={40} max={240} step={1} required value={bpm} onChange={(event) => setBpm(event.target.value)} disabled={busy} /></label>
      <label htmlFor={`${fieldId}-meter`}>박자<Select.Root value={meter} onValueChange={setMeter} disabled={busy}><Select.Trigger id={`${fieldId}-meter`} aria-label="새 프로젝트 박자" /><Select.Content>{TRANSPORT_METERS.map((item) => <Select.Item key={item.label} value={item.label}>{item.label}</Select.Item>)}</Select.Content></Select.Root></label>
    </Flex>}
    {issue && <Text as="p" size="2" color="red" role="alert">{issue}</Text>}
    <Flex gap="2" justify="end">
      <Dialog.Close><Button type="button" variant="soft" color="gray" disabled={busy}>취소</Button></Dialog.Close>
      <Button type="submit" disabled={busy}>{busy ? "저장 중…" : project ? "이름 저장" : "만들고 스튜디오 열기"}</Button>
    </Flex>
  </form>;
}

export function ProjectEditor({ project }: { project?: ProjectSummary }) {
  const [open, setOpen] = useState(false);
  const [draftProject, setDraftProject] = useState(project);
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const station = useStationController();
  useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const reason = station.projectChangeReason;
  const disabled = state.phase !== "ready" || state.operation !== null || reason !== null;
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!state.operation) { if (value) setDraftProject(project); setOpen(value); } }}>
    <Dialog.Trigger><Button variant={project ? "outline" : "solid"} disabled={disabled} title={reason ?? undefined} aria-label={project ? `${project.title} 이름 변경` : "새 프로젝트"}>{project ? "이름 변경" : "새 프로젝트"}</Button></Dialog.Trigger>
    <Dialog.Content className="station-overlay" maxWidth="440px">
      <Dialog.Title>{project ? "프로젝트 이름 변경" : "새 프로젝트"}</Dialog.Title>
      <Dialog.Description size="2">{project ? "이름을 바꿔도 녹음과 믹서 설정은 유지됩니다." : "현재 프로젝트는 보관하고 오디오를 종료한 뒤, 새 스튜디오를 엽니다. 마이크와 재생은 직접 시작하세요."}</Dialog.Description>
      <ProjectForm project={draftProject} onDone={() => setOpen(false)} />
    </Dialog.Content>
  </Dialog.Root>;
}
