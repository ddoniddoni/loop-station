"use client";

import { Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useProjectManager } from "@/components/audio/audio-engine-provider";

export function CurrentProjectName() {
  const manager = useProjectManager();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  const title = state.projects.find((project) => project.id === state.activeId)?.title ?? "로컬 프로젝트";
  return <Text weight="bold" className="station-project-name" title={title}>{title}</Text>;
}
