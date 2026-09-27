"use client";

import { Badge, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { ProjectSummary } from "@/audio/storage/project-catalog";
import { useAudioSessionContext, useProjectManager, useStationController } from "@/components/audio/audio-engine-provider";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ProjectEditor } from "./project-editor";
import { currentProjectStatus } from "./loop-save-label";
import { useStudioView } from "./studio-view-provider";

function ProjectCard({ project }: { project: ProjectSummary }) {
  const manager = useProjectManager();
  const catalog = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const station = useStationController();
  const current = useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const audio = useAudioSessionContext();
  const router = useRouter();
  const { setView } = useStudioView();
  const [issue, setIssue] = useState<string | null>(null);
  const active = project.id === catalog.activeId;
  const disabled = catalog.operation !== null || (!active && station.projectChangeReason !== null);
  async function open() {
    setIssue(null);
    if (!await manager.open(project.id, audio.stopAudio)) { setIssue(manager.getSnapshot().issue ?? "프로젝트를 열지 못했습니다."); return; }
    setView("studio"); router.push("/");
  }
  return <article className="station-project-card" aria-label={project.title}>
    <div className="station-project-cover" aria-hidden="true"><StudioIcon name="loop" size={40} /><span>{project.clipCount} / 8 TRACKS</span></div>
    <div className="station-project-details">
      <Badge color={active ? "green" : "gray"}>{active ? `현재 작업 · ${currentProjectStatus(current.save, current.performing, current.mixerDirty)}` : "이 브라우저에 저장됨"}</Badge>
      <Heading as="h2" size="5" mt="3">{project.title}</Heading>
      <dl className="station-project-metadata">
        <div><dt>저장된 루프</dt><dd>{project.clipCount} / 8 트랙</dd></div>
        <div><dt>템포·박자</dt><dd>{project.transport.bpm} BPM · {project.transport.numerator}/{project.transport.denominator}</dd></div>
        <div><dt>마지막 수정</dt><dd>{project.updatedAtLabel}</dd></div>
      </dl>
      <Flex gap="2" wrap="wrap"><Button disabled={disabled} title={!active ? station.projectChangeReason ?? undefined : undefined} onClick={() => void open()}>{active ? "작업 이어하기" : "프로젝트 열기"}</Button><ProjectEditor project={project} /></Flex>
      {issue && <Text as="p" role="alert" size="2" color="red" mt="2">{issue}</Text>}
    </div>
  </article>;
}

export function MyProjects() {
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const station = useStationController();
  const current = useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const reason = station.projectChangeReason;
  return <section className="station-projects" aria-labelledby="projects-heading">
    <header className="station-projects-heading">
      <Text as="p" className="station-overline">LOOP//STATION · LOCAL</Text>
      <Heading as="h1" id="projects-heading" size="8">내 프로젝트</Heading>
      <Text as="p" size="3" color="gray" mt="3">작업마다 이름을 붙이고, 원하는 루프를 이어가세요.</Text>
    </header>
    <Flex gap="3" wrap="wrap"><ProjectEditor /><Button variant="outline" disabled={state.operation !== null || state.phase === "loading"} onClick={() => void (state.phase === "error" ? manager.initialize() : manager.refresh(true))}>목록 새로고침</Button></Flex>
    <Text as="p" size="2" className="station-projects-policy">다른 프로젝트를 열면 현재 오디오와 마이크 연결이 종료됩니다. 저장되지 않은 변경이 있으면 전환할 수 없습니다.</Text>
    {reason && state.phase === "ready" && <Text as="p" role="status" size="2" mt="3">{reason} 현재 저장 상태는 상단 LOCAL에서 확인하세요.</Text>}
    {state.issue && <div className="station-projects-notice" role="alert"><Heading as="h2" size="3">프로젝트 작업을 완료하지 못했습니다</Heading><Text as="p" size="2" mt="2">{state.issue}</Text>{state.phase === "error" && <Button mt="3" onClick={() => manager.useSessionOnly()}>저장 없이 연주하기</Button>}</div>}
    {state.selectionIssue && <Text as="p" size="2" role="status" mt="3">{state.selectionIssue}</Text>}
    {state.phase === "loading" && <Text as="p" className="station-projects-empty" role="status">프로젝트 목록을 불러오고 있습니다…</Text>}
    {state.phase === "ready" && state.projects.length === 0 && <div className="station-projects-empty">
      <StudioIcon name="folder" size={32} /><Heading as="h2" size="5" mt="3">아직 저장된 프로젝트가 없습니다</Heading>
      <Text as="p" size="2" color="gray" mt="2">새 프로젝트를 만들어 시작하세요. 기존 스튜디오에서 녹음한 작업도 저장되면 여기에 표시됩니다.</Text>
    </div>}
    {current.save.issue && state.phase === "ready" && <Text as="p" role="status" size="2" mt="3">{current.save.issue}</Text>}
    <div className="station-project-list">{state.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
    <Text as="p" size="2" color="gray" mt="5">프로젝트는 이 브라우저에 저장됩니다. 브라우저 데이터 삭제 시 사라지며, 파일 백업·복제·삭제는 아직 지원하지 않습니다.</Text>
  </section>;
}
