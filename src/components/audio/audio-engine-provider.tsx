"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MicrophoneController } from "@/audio/input/microphone-controller";
import { LoopController } from "@/audio/loop/loop-controller";
import { useAudioSession } from "@/components/audio/use-audio-session";

const AudioSessionContext = createContext<ReturnType<typeof useAudioSession> | null>(null);
const MicrophoneContext = createContext<MicrophoneController | null>(null);
const LoopContext = createContext<LoopController | null>(null);

export function AudioEngineProvider({ children }: { children: ReactNode }) {
  const [microphone] = useState(() => new MicrophoneController());
  const [loop] = useState(() => new LoopController(microphone));
  const audio = useAudioSession(microphone, loop);

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

export function useLoopController(): LoopController {
  const context = useContext(LoopContext);
  if (!context) throw new Error("AudioEngineProvider is required");
  return context;
}
