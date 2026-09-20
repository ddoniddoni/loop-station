"use client";

import { Button, Flex, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { AudioSetupError, TestToneEngine } from "@/audio/engine/test-tone-engine";
import { ko } from "@/lib/i18n/ko";

type AudioPhase = "idle" | "starting" | "ready" | "playing" | "suspended" | "stopping" | "error";

const phaseStatus: Record<AudioPhase, string> = {
  idle: ko.audioIdle,
  starting: ko.audioStarting,
  ready: ko.audioReady,
  playing: ko.audioPlaying,
  suspended: ko.audioSuspended,
  stopping: ko.audioStopping,
  error: ko.audioErrors.startFailed,
};

type AudioControlsProps = {
  phase: AudioPhase;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onToneStart: () => void;
  onToneStop: () => void;
};

function AudioControls({ phase, onStart, onStop, onResume, onToneStart, onToneStop }: AudioControlsProps) {
  return (
    <Flex gap="3" wrap="wrap">
      {(phase === "idle" || phase === "error") && (
        <Button type="button" onClick={onStart}>{phase === "error" ? ko.audioRetry : ko.audioStart}</Button>
      )}
      {phase === "ready" && (
        <Button type="button" onClick={onToneStart}>{ko.toneStart}</Button>
      )}
      {phase === "playing" && (
        <Button type="button" variant="soft" onClick={onToneStop}>{ko.toneStop}</Button>
      )}
      {phase === "suspended" && (
        <Button type="button" onClick={onResume}>{ko.audioResume}</Button>
      )}
      {phase !== "idle" && phase !== "error" && (
        <Button type="button" variant="outline" color="gray" disabled={phase === "stopping"} onClick={onStop}>
          {phase === "starting" ? ko.audioCancel : ko.audioEnd}
        </Button>
      )}
    </Flex>
  );
}

function release(engine: TestToneEngine): void {
  void engine.dispose().catch(() => undefined);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AudioSetupError ? ko.audioErrors[error.code] : fallback;
}

export function AudioSetup() {
  const engineRef = useRef<TestToneEngine | null>(null);
  const [phase, setPhase] = useState<AudioPhase>("idle");
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [issue, setIssue] = useState<string | null>(null);

  useEffect(() => () => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (engine) release(engine);
  }, []);

  async function startAudio(): Promise<void> {
    if (engineRef.current) return;
    setIssue(null);
    setPhase("starting");

    let engine: TestToneEngine;
    try {
      engine = new TestToneEngine({
        onContextStateChange: (state) => {
          if (engineRef.current !== engine) return;
          if (state === "running") {
            setPhase((current) => engine.isReady ? (current === "playing" ? current : "ready") : "starting");
          } else if (state === "closed") {
            engineRef.current = null;
            release(engine);
            setSampleRate(null);
            setPhase("error");
            setIssue(ko.audioErrors.closed);
          } else {
            setPhase("suspended");
          }
        },
        onToneStateChange: (playing) => {
          if (engineRef.current === engine && engine.state === "running") {
            setPhase(playing ? "playing" : "ready");
          }
        },
        onProcessorError: () => {
          if (engineRef.current !== engine) return;
          engineRef.current = null;
          release(engine);
          setSampleRate(null);
          setPhase("error");
          setIssue(ko.audioErrors.processorFailed);
        },
      });
    } catch (error) {
      setPhase("error");
      setIssue(errorMessage(error, ko.audioErrors.startFailed));
      return;
    }

    engineRef.current = engine;
    try {
      await engine.initialize();
      if (engineRef.current !== engine) return;
      setSampleRate(engine.sampleRate);
      setPhase(engine.state === "running" ? "ready" : "suspended");
    } catch (error) {
      if (engineRef.current !== engine) return;
      await engine.dispose().catch(() => undefined);
      engineRef.current = null;
      setSampleRate(null);
      setPhase("error");
      setIssue(errorMessage(error, ko.audioErrors.startFailed));
    }
  }

  async function stopAudio(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    engineRef.current = null;
    setPhase("stopping");
    try {
      await engine.dispose();
      setPhase("idle");
      setIssue(null);
    } catch {
      setPhase("error");
      setIssue(ko.audioErrors.closeFailed);
    } finally {
      setSampleRate(null);
    }
  }

  async function resumeAudio(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    setPhase("starting");
    setIssue(null);
    try {
      await engine.resume();
      if (engineRef.current === engine) setPhase("ready");
    } catch (error) {
      if (engineRef.current !== engine) return;
      setPhase("suspended");
      setIssue(errorMessage(error, ko.audioErrors.resumeFailed));
    }
  }

  const status = issue ?? phaseStatus[phase];

  return (
    <div className="mt-5">
      <AudioControls
        phase={phase}
        onStart={() => void startAudio()}
        onStop={() => void stopAudio()}
        onResume={() => void resumeAudio()}
        onToneStart={() => engineRef.current?.startTone()}
        onToneStop={() => engineRef.current?.stopTone()}
      />
      <Text as="p" role={phase === "error" ? "alert" : "status"} size="2" color={issue ? "red" : "gray"} mt="3">
        {status}
        {sampleRate !== null && phase !== "error" && <> · {ko.sampleRate}: {sampleRate} Hz</>}
      </Text>
    </div>
  );
}
