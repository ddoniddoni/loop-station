"use client";

import { Button, Flex, Heading, Popover, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useStationController } from "@/components/audio/audio-engine-provider";
import { ko } from "@/lib/i18n/ko";
import { saveStatusLabel } from "./loop-save-label";

export function LoopSaveStatus() {
  const controller = useStationController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const { save } = snapshot;
  const performing = snapshot.performing;
  const label = snapshot.mixerDirty && !save.editLocked && save.phase !== "error" && save.phase !== "session"
    ? ko.mixerUnsaved : saveStatusLabel(save);
  const problem = save.phase === "error" || save.phase === "conflict";
  return <Popover.Root>
    <Popover.Trigger>
      <Button className="station-save-trigger" variant="ghost" color={problem ? "amber" : "gray"} aria-label={`로컬 저장 상태: ${label}`}>
        <span role="status">{label}</span><span aria-hidden="true"> · LOCAL</span>
      </Button>
    </Popover.Trigger>
    <Popover.Content className="station-overlay" width="320" sideOffset={8}>
      <Heading as="h2" size="3">로컬 저장</Heading>
      <Text as="p" size="2" mt="2">8개 트랙의 녹음·오버더빙과 Undo/Redo·비우기 복구 이력, 볼륨·팬·Mute·Solo와 루프 마스터 설정을 하나의 프로젝트로 이 브라우저에 자동 저장합니다.</Text>
      <Text as="p" size="2" mt="2" role="status">{label}{save.savedAtLabel ? ` · 마지막 저장 ${save.savedAtLabel}` : ""}</Text>
      {save.issue && <Text as="p" size="2" mt="2" color={problem ? "amber" : "gray"} role={problem ? "alert" : undefined}>{save.issue}</Text>}
      {problem && <Flex gap="2" wrap="wrap" mt="3">
        {save.canRetry && <Button disabled={performing} onClick={() => void controller.retryStorage()}>{save.editLocked ? "불러오기 재시도" : "저장 재시도"}</Button>}
        <Button variant="outline" color="gray" disabled={performing} onClick={() => controller.useSessionOnly()}>저장 없이 계속</Button>
      </Flex>}
      <Text as="p" size="1" mt="3" color="gray">저장 완료된 변경만 새로고침 후 복구됩니다. 녹음 도중 닫으면 진행 중인 입력은 사라질 수 있습니다. 복구 후 오디오 시작과 재생은 직접 눌러야 합니다.</Text>
      <Text as="p" size="1" mt="2" color="gray">브라우저 데이터 삭제나 비공개 모드 종료 시 저장본이 사라질 수 있습니다. 파일 백업은 아직 준비 중입니다.</Text>
    </Popover.Content>
  </Popover.Root>;
}
