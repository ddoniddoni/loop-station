// Increment when the UI/processor startup contract becomes incompatible.
// Branches for count-in and AUTO use 2 and 3. Scheduling adds pending command state.
export const WORKLET_PROTOCOL_VERSION = 4;
export const AUDIO_STARTUP_TIMEOUT_MS = 15_000;

export function isWorkletReady(value: unknown, sampleRate: number): boolean {
  return typeof value === "object" && value !== null
    && "type" in value && value.type === "worklet-ready"
    && "version" in value && value.version === WORKLET_PROTOCOL_VERSION
    && "sampleRate" in value && value.sampleRate === sampleRate
    && "blockFrames" in value && typeof value.blockFrames === "number"
    && Number.isSafeInteger(value.blockFrames) && value.blockFrames > 0;
}
