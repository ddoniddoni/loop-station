"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MicrophoneController } from "@/audio/input/microphone-controller";
import { useAudioSession } from "@/components/audio/use-audio-session";

const AudioSessionContext = createContext<ReturnType<typeof useAudioSession> | null>(null);
const MicrophoneContext = createContext<MicrophoneController | null>(null);

export function AudioEngineProvider({ children }: { children: ReactNode }) {
  const [microphone] = useState(() => new MicrophoneController());
  const audio = useAudioSession(microphone);

  return (
    <MicrophoneContext value={microphone}>
      <AudioSessionContext value={audio}>{children}</AudioSessionContext>
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
