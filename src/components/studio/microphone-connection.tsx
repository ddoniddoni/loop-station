"use client";

import { Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import { useSyncExternalStore } from "react";
import { useAudioSessionContext, useMicrophoneController } from "@/components/audio/audio-engine-provider";
import { MicrophoneSetup } from "@/components/audio/microphone-setup";
import { useStudioView } from "./studio-view-provider";

function AudioConnectionStep() {
  const audio = useAudioSessionContext();
  const ready = audio.phase === "ready" || audio.phase === "playing";
  return <section className="station-connection-step" aria-labelledby="connect-audio-title">
    <Heading as="h3" id="connect-audio-title" size="3">1. 오디오 준비</Heading>
    <Text as="p" size="2" mt="2">{ready ? "오디오가 준비되었습니다." : "녹음과 재생에 사용할 오디오를 시작하세요."}</Text>
    {(audio.phase === "idle" || audio.phase === "error") && <Button mt="3" onClick={() => void audio.startAudio()}>오디오 시작</Button>}
    {audio.phase === "suspended" && <Button mt="3" onClick={() => void audio.resumeAudio()}>오디오 다시 시작</Button>}
    {audio.phase === "starting" && <Button mt="3" onClick={() => void audio.stopAudio()}>오디오 준비 취소</Button>}
    {audio.phase === "stopping" && <Text as="p" size="2" role="status">오디오 종료 중…</Text>}
    {audio.phase === "close-error" && <Button mt="3" onClick={() => void audio.stopAudio()}>오디오 종료 재시도</Button>}
    {audio.issue && <Text as="p" size="2" color="red" role="alert" mt="2">{audio.issue}</Text>}
  </section>;
}

export function MicrophoneConnection() {
  const controller = useMicrophoneController();
  const input = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const { inputOpen, setInputOpen } = useStudioView();
  const connected = input.phase === "active";
  return <Dialog.Root open={inputOpen} onOpenChange={setInputOpen}>
    <Dialog.Trigger><Button className="station-microphone-connect" variant={connected ? "outline" : "solid"}>
      {connected ? "마이크 설정" : "마이크 연결"}
    </Button></Dialog.Trigger>
    <Dialog.Content maxWidth="520px" className="station-overlay station-input-dialog">
      <Flex align="center" justify="between" gap="3">
        <Dialog.Title mb="0">마이크 연결과 입력 설정</Dialog.Title>
        <Dialog.Close><Button variant="soft" color="gray" aria-label="입력 설정 닫기">닫기</Button></Dialog.Close>
      </Flex>
      <Dialog.Description size="2" mt="2" mb="4">오디오를 시작한 뒤 마이크 사용을 허용하세요. 연결만으로 녹음이 시작되지는 않습니다.</Dialog.Description>
      <AudioConnectionStep />
      <section className="station-connection-step" aria-label="2. 마이크 권한과 장치 선택">
        <Text as="p" weight="bold" mb="2">2. 마이크 연결 · 브라우저 권한창에서 허용</Text>
        <MicrophoneSetup />
      </section>
      <Text as="p" size="2" mt="4">3. 창을 닫고 원하는 트랙의 녹음 버튼을 누르세요.</Text>
      <Text as="p" size="1" color="gray" mt="2">내 소리 듣기는 기본 OFF입니다. 헤드폰으로 듣고 싶을 때만 켜세요. 창을 닫아도 연결은 유지되며, 마이크 해제를 누르면 끊어집니다.</Text>
    </Dialog.Content>
  </Dialog.Root>;
}
