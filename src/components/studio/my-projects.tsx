"use client";

import { Badge, Button, Heading, Text } from "@radix-ui/themes";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { StationController } from "@/audio/loop/station-controller";
import type { LoopSaveState } from "@/audio/storage/loop-persistence";
import { useStationController } from "@/components/audio/audio-engine-provider";
import { StudioIcon } from "@/components/ui/studio-icon";
import { saveStatusLabel } from "./loop-save-label";
import { useStudioView } from "./studio-view-provider";

type ProjectSnapshot = ReturnType<StationController["getSnapshot"]>;

function ProjectCard({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { setView } = useStudioView();
  const { save, clipCount, config, performing, mixerDirty } = snapshot;
  const problem = save.phase === "error" || save.phase === "conflict";
  let status = saveStatusLabel(save);
  if (performing) status = "녹음·편집 중";
  else if (mixerDirty && !problem && save.phase !== "session") status = "저장할 변경이 있습니다";
  return <article className="station-project-card" aria-labelledby="local-project-title">
    <div className="station-project-cover" aria-hidden="true"><StudioIcon name="loop" size={48} /><span>8 TRACKS</span></div>
    <div className="station-project-details">
      <Badge color={problem || save.phase === "session" ? "amber" : "green"} variant="soft">{status}</Badge>
      <Heading as="h2" id="local-project-title" size="5" mt="3">로컬 프로젝트</Heading>
      <dl className="station-project-metadata">
        <div><dt>현재 루프</dt><dd>{clipCount} / 8 트랙</dd></div>
        <div><dt>템포·박자</dt><dd>{config ? `${config.bpm} BPM · ${config.numerator}/${config.denominator}` : "첫 녹음 전"}</dd></div>
        <div><dt>마지막 저장</dt><dd>{save.savedAtLabel ?? "아직 저장되지 않음"}</dd></div>
      </dl>
      <Button asChild><Link href="/" onClick={() => setView("studio")}>작업 이어하기</Link></Button>
    </div>
  </article>;
}

function ProjectNotice({ snapshot }: { snapshot: ProjectSnapshot }) {
  const controller = useStationController();
  const { save, performing } = snapshot;
  if (save.phase === "session") return <Text as="p" size="2" className="station-projects-notice" role="status">현재 작업은 이 탭에만 보관됩니다. 새로고침하면 저장되지 않은 변경이 사라집니다.</Text>;
  if (save.phase !== "error" && save.phase !== "conflict") return null;
  return <div className="station-projects-notice" role="alert">
    <Heading as="h2" size="3">{saveStatusLabel(save)}</Heading>
    <Text as="p" size="2" mt="2">{save.issue}</Text>
    {save.canRetry && <Button mt="3" disabled={performing} onClick={() => void controller.retryStorage()}>{save.editLocked ? "불러오기 재시도" : "저장 재시도"}</Button>}
  </div>;
}

function EmptyProjects({ save }: { save: LoopSaveState }) {
  const { setView } = useStudioView();
  return <div className="station-projects-empty">
    <StudioIcon name="folder" size={32} />
    <Heading as="h2" size="5" mt="3">아직 저장된 프로젝트가 없습니다</Heading>
    <Text as="p" size="2" color="gray" mt="2">{save.phase === "session" ? "스튜디오에서 첫 루프를 녹음할 수 있습니다. 현재는 자동 저장을 사용하지 않습니다." : "스튜디오에서 마이크를 연결하고 첫 루프를 녹음하세요. 녹음이 끝나면 자동 저장됩니다."}</Text>
    <Button asChild mt="4"><Link href="/" onClick={() => setView("studio")}>스튜디오에서 시작하기</Link></Button>
  </div>;
}

function ProjectContent({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { save, clipCount, mixerDirty, performing } = snapshot;
  if (save.phase === "loading") return <Text as="p" role="status" className="station-projects-empty">저장된 프로젝트를 확인하고 있습니다…</Text>;
  const hasWork = save.savedAt !== null || clipCount > 0 || mixerDirty || performing || save.phase === "saving";
  const problem = save.phase === "error" || save.phase === "conflict";
  if (save.phase === "error" && save.editLocked) return <ProjectNotice snapshot={snapshot} />;
  return <>
    <ProjectNotice snapshot={snapshot} />
    {hasWork ? <ProjectCard snapshot={snapshot} /> : !problem && <EmptyProjects save={save} />}
  </>;
}

export function MyProjects() {
  const controller = useStationController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return <section className="station-projects" aria-labelledby="projects-heading">
    <header className="station-projects-heading">
      <Text as="p" className="station-overline">LOOP//STATION · LOCAL</Text>
      <Heading as="h1" id="projects-heading" size="8">내 프로젝트</Heading>
      <Text as="p" size="3" color="gray" mt="3">이 브라우저에서 작업하던 루프를 이어가세요.</Text>
    </header>
    <Text as="p" size="2" className="station-projects-policy">현재는 자동 저장 프로젝트 1개를 지원합니다. 여러 프로젝트 생성·이름 변경·복제·삭제는 준비 중입니다.</Text>
    <ProjectContent snapshot={snapshot} />
    <Text as="p" size="2" color="gray" mt="5">브라우저 데이터를 삭제하면 저장본도 사라집니다. 파일 백업과 클라우드 동기화는 아직 지원하지 않습니다.</Text>
    <Text as="p" size="2" color="gray" mt="2">페이지를 이동해도 현재 작업과 오디오는 유지됩니다. 연주를 멈추려면 상단 정지 또는 PANIC을 누르세요.</Text>
  </section>;
}
