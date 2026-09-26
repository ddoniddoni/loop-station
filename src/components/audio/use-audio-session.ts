"use client";

import { useEffect, useRef, useState } from "react";
import { AudioSetupError, TestToneEngine } from "@/audio/engine/test-tone-engine";
import type { MicrophoneController } from "@/audio/input/microphone-controller";
import type { StationController } from "@/audio/loop/station-controller";
import type { TransportConfig, TransportSnapshot } from "@/audio/transport/audio-frame-clock";
import { ko } from "@/lib/i18n/ko";

export type AudioPhase = "idle" | "starting" | "ready" | "playing" | "suspended" | "stopping" | "close-error" | "error";

function release(engine: TestToneEngine): void {
  void engine.dispose().catch(() => undefined);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AudioSetupError ? ko.audioErrors[error.code] : fallback;
}

export function useAudioSession(input: MicrophoneController, loop: StationController) {
  const engineRef = useRef<TestToneEngine | null>(null);
  const closingRef = useRef<TestToneEngine | null>(null);
  const operationRef = useRef(0);
  const [phase, setPhase] = useState<AudioPhase>("idle");
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [transport, setTransport] = useState<TransportSnapshot | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean | null>(null);
  const [metronomeVolume, setMetronomeVolume] = useState(50);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [issue, setIssue] = useState<string | null>(null);

  useEffect(() => () => {
    operationRef.current += 1;
    const engine = engineRef.current;
    engineRef.current = null;
    if (engine) release(engine);
    input.dispose();
  }, [input]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (loop.dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [loop]);

  async function closeAudio(engine: TestToneEngine, failure: string | null = null): Promise<void> {
    if (engineRef.current !== engine || closingRef.current === engine) return;
    const operation = ++operationRef.current;
    closingRef.current = engine;
    setPhase("stopping");
    setTransport(null);
    setMetronomeEnabled(null);
    setSampleRate(null);
    try {
      await engine.dispose();
      if (engineRef.current !== engine || operation !== operationRef.current) return;
      engineRef.current = null;
      setPhase(failure ? "error" : "idle");
      setIssue(failure);
    } catch {
      if (engineRef.current !== engine || operation !== operationRef.current) return;
      // A failed close still owns the context. Retry teardown before allowing a new one.
      setPhase("close-error");
      setIssue(ko.audioErrors.closeFailed);
    } finally {
      if (closingRef.current === engine) closingRef.current = null;
    }
  }

  async function startAudio(): Promise<void> {
    if (engineRef.current || closingRef.current) return;
    const operation = ++operationRef.current;
    setIssue(null);
    setPhase("starting");
    setTransport(null);
    setMetronomeEnabled(null);
    setMetronomeVolume(50);

    let engine: TestToneEngine;
    try {
      engine = new TestToneEngine({
        onContextStateChange: (state) => {
          if (engineRef.current !== engine) return;
          if (state === "running") {
            setPhase((current) => engine.isReady ? (current === "playing" ? current : "ready") : "starting");
          } else if (state === "closed") {
            void closeAudio(engine, ko.audioErrors.closed);
          } else {
            setPhase("suspended");
          }
        },
        onToneStateChange: (playing) => {
          if (engineRef.current === engine && engine.state === "running") {
            setPhase(playing ? "playing" : "ready");
          }
        },
        onTransportStateChange: (snapshot) => {
          if (engineRef.current === engine) setTransport(snapshot);
        },
        onMetronomeStateChange: (enabled) => {
          if (engineRef.current === engine) setMetronomeEnabled(enabled);
        },
        onProcessorError: () => {
          if (engineRef.current !== engine) return;
          void closeAudio(engine, ko.audioErrors.processorFailed);
        },
      }, input, loop);
    } catch (error) {
      setPhase("error");
      setIssue(errorMessage(error, ko.audioErrors.startFailed));
      return;
    }

    engineRef.current = engine;
    try {
      await engine.initialize();
      if (engineRef.current !== engine || operation !== operationRef.current) return;
      setSampleRate(engine.sampleRate);
      setPhase(engine.state === "running" ? "ready" : "suspended");
    } catch (error) {
      if (engineRef.current !== engine || operation !== operationRef.current) return;
      await closeAudio(engine, errorMessage(error, ko.audioErrors.startFailed));
    }
  }

  async function stopAudio(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    await closeAudio(engine);
  }

  async function resumeAudio(): Promise<void> {
    const engine = engineRef.current;
    if (!engine || closingRef.current) return;
    const operation = ++operationRef.current;
    setPhase("starting");
    setIssue(null);
    try {
      await engine.resume();
      if (engineRef.current === engine && operation === operationRef.current) setPhase("ready");
    } catch (error) {
      if (engineRef.current !== engine || operation !== operationRef.current) return;
      setPhase("suspended");
      setIssue(errorMessage(error, ko.audioErrors.resumeFailed));
    }
  }

  return {
    phase, sampleRate, transport, metronomeEnabled, metronomeVolume, countInEnabled, issue,
    startAudio, stopAudio, resumeAudio,
    startTone: () => engineRef.current?.startTone(),
    stopTone: () => engineRef.current?.stopTone(),
    startTransport: () => engineRef.current?.startTransport(),
    stopTransport: () => engineRef.current?.stopTransport(),
    resetTransport: () => engineRef.current?.resetTransport(),
    configureTransport: (config: TransportConfig) => engineRef.current?.configureTransport(config),
    setMetronomeEnabled: (enabled: boolean) => engineRef.current?.setMetronomeEnabled(enabled),
    setCountInEnabled: (enabled: boolean) => {
      if (!loop.getSnapshot().performing) setCountInEnabled(enabled);
    },
    setMetronomeVolume: (volume: number) => {
      engineRef.current?.setMetronomeVolume(volume);
      setMetronomeVolume(volume);
    },
  };
}
