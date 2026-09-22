"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MicrophoneController } from "@/audio/input/microphone-controller";
import type { LoopController } from "@/audio/loop/loop-controller";
import { StationController } from "@/audio/loop/station-controller";
import { useAudioSession } from "@/components/audio/use-audio-session";

const AudioSessionContext = createContext<ReturnType<typeof useAudioSession> | null>(null);
const MicrophoneContext = createContext<MicrophoneController | null>(null);
const LoopContext = createContext<StationController | null>(null);

export function AudioEngineProvider({ children }: { children: ReactNode }) {
  const [microphone] = useState(() => new MicrophoneController());
  const [loop] = useState(() => new StationController(microphone));
  const audio = useAudioSession(microphone, loop);

  useEffect(() => {
    const stopListening = loop.listenForStorageChanges();
    void loop.initializeStorage();
    return stopListening;
  }, [loop]);

  return (
    <MicrophoneContext value={microphone}>
      <LoopContext value={loop}><AudioSessionContext value={audio}>{children}</AudioSessionContext></LoopContext>
    </MicrophoneContext>
  );
}

export function useAudioSessionContext() {
  const context = useContext(AudioSessionContext);
  if (!context) throw new Error("AudioEngineProvider is required");
  return context;
}

export function useMicrophoneController(): MicrophoneController {
  const context = useContext(MicrophoneContext);
  if (!context) throw new Error("AudioEngineProvider is required");
  return context;
}

export function useStationController(): StationController {
  const context = useContext(LoopContext);
  if (!context) throw new Error("AudioEngineProvider is required");
  return context;
}

export function useLoopController(trackId: number): LoopController {
  const station = useStationController();
  const track = station.tracks[trackId];
  if (!track) throw new Error("Invalid track ID");
  return track;
}
