"use client";

import { Button, Kbd, Text } from "@radix-ui/themes";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { useAudioSessionContext, useMicrophoneController, useStationController } from "@/components/audio/audio-engine-provider";
import { executePerformanceAction, performanceActionLabels, performanceCommand, performanceDecision, type PerformanceCommand } from "@/lib/keyboard/performance-commands";
import { shortcutTargetBlocked } from "@/lib/keyboard/shortcut-target";

const shortcuts: { key: string; command: Exclude<PerformanceCommand, object> }[] = [
  { key: "Space", command: "transport" }, { key: "R", command: "primary" }, { key: "S", command: "stop" },
  { key: "Esc", command: "cancel" }, { key: "Ctrl/Cmd+Z", command: "undo" }, { key: "Ctrl/Cmd+Shift+Z", command: "redo" },
];

export function KeyboardControls({ selectedTrackId, getSelectedTrack, onSelectTrack }: {
  selectedTrackId: number; getSelectedTrack: () => number; onSelectTrack: (trackId: number) => void;
}) {
  const audio = useAudioSessionContext();
  const station = useStationController();
  const microphone = useMicrophoneController();
  const controller = station.tracks[selectedTrackId];
  const track = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const project = useSyncExternalStore(station.subscribe, station.getSnapshot, station.getServerSnapshot);
  const input = useSyncExternalStore(microphone.subscribe, microphone.getSnapshot, microphone.getServerSnapshot);
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState("키보드 연주를 켜면 단축키를 사용할 수 있습니다.");
  const panel = useRef<HTMLElement>(null);
  const composing = useRef(false);
  const audioReady = (audio.phase === "ready" || audio.phase === "playing") && audio.transport !== null;

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled || composing.current || shortcutTargetBlocked(event, document)) return;
    const command = performanceCommand(event);
    if (command === null) return;
    event.preventDefault();
    if (typeof command === "object") {
      onSelectTrack(command.trackId);
      setNotice(`${command.trackId + 1}번 트랙 선택`);
      return;
    }
    const selected = getSelectedTrack();
    const target = station.tracks[selected];
    const currentInput = microphone.getSnapshot();
    const decision = performanceDecision(command, {
      track: target.getSnapshot(), audioReady, inputReady: currentInput.phase === "active" && currentInput.routed,
      projectBusy: station.getSnapshot().performing, transportPlaying: audio.transport?.playing ?? false,
    });
    if (decision.action === null) { setNotice(decision.reason); return; }
    executePerformanceAction(decision.action, target, audio);
    setNotice(`${command === "transport" ? "전체" : `${selected + 1}번 트랙`} · ${performanceActionLabels[decision.action]} 요청`);
  });

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => onKeyDown(event);
    const compositionStart = () => { composing.current = true; };
    const clearComposition = () => { composing.current = false; };
    document.addEventListener("keydown", keyDown);
    document.addEventListener("compositionstart", compositionStart);
    document.addEventListener("compositionend", clearComposition);
    window.addEventListener("blur", clearComposition);
    return () => {
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("compositionstart", compositionStart);
      document.removeEventListener("compositionend", clearComposition);
      window.removeEventListener("blur", clearComposition);
    };
  }, []);

  return <section ref={panel} tabIndex={0} className="station-keyboard" aria-label="키보드 연주 영역" aria-describedby="keyboard-help">
    <div className="station-keyboard-heading">
      <Button type="button" variant={enabled ? "soft" : "outline"} aria-pressed={enabled} onClick={() => {
        setEnabled(!enabled);
        setNotice(enabled ? "키보드 연주를 껐습니다." : "키보드 연주를 켰습니다. 1–8로 트랙을 선택하세요.");
        if (!enabled) panel.current?.focus();
      }}>키보드 연주 {enabled ? "켜짐" : "꺼짐"}</Button>
      <Text as="span" size="2">선택 트랙 {String(selectedTrackId + 1).padStart(2, "0")} · <Kbd>1–8</Kbd> 선택 · <Kbd>R</Kbd> REC / PLAY / OVERDUB</Text>
      {enabled && <Button type="button" variant="ghost" onClick={() => panel.current?.focus()}>연주 영역으로 이동</Button>}
    </div>
    <Text as="p" size="1" id="keyboard-help" color="gray">영문 입력에서 사용하세요. 입력란·버튼에 포커스가 있거나 설정창이 열려 있거나 한글 조합 중이면 단축키가 동작하지 않습니다. Esc는 선택 트랙 취소이며 전체 음소거가 아닙니다.</Text>
    <Text as="p" size="1" role="status" className="station-keyboard-status">{notice}</Text>
    <details><summary>단축키와 현재 사용 가능 상태</summary><dl className="station-keyboard-map">{shortcuts.map(({ key, command }) => {
      const decision = performanceDecision(command, { track, audioReady, inputReady: input.phase === "active" && input.routed,
        projectBusy: project.performing, transportPlaying: audio.transport?.playing ?? false });
      return <div key={key}><dt><Kbd>{key}</Kbd></dt><dd>{!enabled ? "키보드 연주를 켜세요." : decision.action ? performanceActionLabels[decision.action] : decision.reason}</dd></div>;
    })}</dl><Text as="p" size="1" color="gray">R은 빈 트랙 녹음 → 정지한 루프 재생 → 재생 중 한 바퀴 오버더빙 순서입니다. 녹음·편집 중 R은 실행하지 않습니다. Mute·Solo·수동 저장·Panic 단축키와 사용자 지정 키는 준비 중입니다.</Text></details>
  </section>;
}
