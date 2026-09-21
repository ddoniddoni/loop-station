"use client";

import { useEffect, useRef, useState } from "react";
import { AudioSetupError, TestToneEngine } from "@/audio/engine/test-tone-engine";
import type { MicrophoneController } from "@/audio/input/microphone-controller";
import type { TransportConfig, TransportSnapshot } from "@/audio/transport/audio-frame-clock";
import { ko } from "@/lib/i18n/ko";

export type AudioPhase = "idle" | "starting" | "ready" | "playing" | "suspended" | "stopping" | "error";

function release(engine: TestToneEngine): void {
  void engine.dispose().catch(() => undefined);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AudioSetupError ? ko.audioErrors[error.code] : fallback;
}

export function useAudioSession(input: MicrophoneController) {
  const engineRef = useRef<TestToneEngine | null>(null);
  const [phase, setPhase] = useState<AudioPhase>("idle");
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [transport, setTransport] = useState<TransportSnapshot | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean | null>(null);
  const [metronomeVolume, setMetronomeVolume] = useState(50);
  const [issue, setIssue] = useState<string | null>(null);

  useEffect(() => () => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (engine) release(engine);
    input.dispose();
  }, [input]);

  async function startAudio(): Promise<void> {
    if (engineRef.current) return;
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
            engineRef.current = null;
            release(engine);
            setSampleRate(null);
            setTransport(null);
            setMetronomeEnabled(null);
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
        onTransportStateChange: (snapshot) => {
          if (engineRef.current === engine) setTransport(snapshot);
        },
        onMetronomeStateChange: (enabled) => {
          if (engineRef.current === engine) setMetronomeEnabled(enabled);
        },
        onProcessorError: () => {
          if (engineRef.current !== engine) return;
          engineRef.current = null;
          release(engine);
          setSampleRate(null);
          setTransport(null);
          setMetronomeEnabled(null);
          setPhase("error");
          setIssue(ko.audioErrors.processorFailed);
        },
      }, input);
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
      setTransport(null);
      setMetronomeEnabled(null);
      setPhase("error");
      setIssue(errorMessage(error, ko.audioErrors.startFailed));
    }
  }

  async function stopAudio(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    engineRef.current = null;
    setPhase("stopping");
    setTransport(null);
    setMetronomeEnabled(null);
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

  return {
    phase, sampleRate, transport, metronomeEnabled, metronomeVolume, issue,
    startAudio, stopAudio, resumeAudio,
    startTone: () => engineRef.current?.startTone(),
    stopTone: () => engineRef.current?.stopTone(),
    startTransport: () => engineRef.current?.startTransport(),
    stopTransport: () => engineRef.current?.stopTransport(),
    resetTransport: () => engineRef.current?.resetTransport(),
    configureTransport: (config: TransportConfig) => engineRef.current?.configureTransport(config),
    setMetronomeEnabled: (enabled: boolean) => engineRef.current?.setMetronomeEnabled(enabled),
    setMetronomeVolume: (volume: number) => {
      engineRef.current?.setMetronomeVolume(volume);
      setMetronomeVolume(volume);
    },
  };
}
