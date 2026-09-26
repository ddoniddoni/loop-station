export const INPUT_PROCESSING_KEYS = ["echoCancellation", "noiseSuppression", "autoGainControl"] as const;
export type InputProcessingKey = typeof INPUT_PROCESSING_KEYS[number];
export type InputProcessingRequest = Record<InputProcessingKey, boolean>;
export type InputProcessingSupport = "available" | "unsupported" | "unknown" | "fixed-on" | "fixed-off";
export type InputProcessingCapabilities = Record<InputProcessingKey, InputProcessingSupport>;

export const MUSIC_INPUT_PROCESSING: InputProcessingRequest = {
  echoCancellation: false, noiseSuppression: false, autoGainControl: false,
};

export function isInputProcessingKey(value: unknown): value is InputProcessingKey {
  return INPUT_PROCESSING_KEYS.some((key) => key === value);
}

export function processingSupport(supported: unknown, capability: unknown, canApply: boolean): InputProcessingSupport {
  if (supported === false || !canApply) return "unsupported";
  if (supported !== true || !Array.isArray(capability)) return "unknown";
  const on = capability.includes(true);
  const off = capability.includes(false);
  if (on && off) return "available";
  if (on) return "fixed-on";
  if (off) return "fixed-off";
  return "unknown";
}

// Browser-wide support does not imply that this particular device is adjustable.
export function readProcessingCapabilities(track: MediaStreamTrack, devices: MediaDevices): InputProcessingCapabilities {
  let supported: MediaTrackSupportedConstraints | null = null;
  let capabilities: MediaTrackCapabilities | null = null;
  try { supported = devices.getSupportedConstraints?.() ?? null; } catch { /* Report unknown. */ }
  try { capabilities = track.getCapabilities?.() ?? null; } catch { /* Report unknown. */ }
  const read = (key: InputProcessingKey) => processingSupport(
    supported ? supported[key] === true : undefined,
    capabilities?.[key],
    typeof track.applyConstraints === "function" && typeof track.getConstraints === "function",
  );
  return { echoCancellation: read("echoCancellation"), noiseSuppression: read("noiseSuppression"), autoGainControl: read("autoGainControl") };
}

export function processingValue(value: unknown): boolean | "all" | "remote-only" | null {
  return typeof value === "boolean" || value === "all" || value === "remote-only" ? value : null;
}

export function processingMatches(value: unknown, requested: boolean): boolean | null {
  const actual = processingValue(value);
  return actual === null ? null : (actual !== false) === requested;
}
