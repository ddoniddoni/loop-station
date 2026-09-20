export type StorageEstimate = {
  status: "available" | "unavailable" | "error";
  usage?: number;
  quota?: number;
};

export type EnvironmentReport = {
  secureContext: boolean;
  audioWorkletApi: boolean;
  microphoneApi: boolean;
  midiApi: boolean;
  indexedDbApi: boolean;
  crossOriginIsolated: boolean;
  storageEstimate: StorageEstimate;
  persistentStorage: boolean | null;
};

function hasIndexedDbApi(): boolean {
  try {
    return typeof window.indexedDB !== "undefined";
  } catch {
    return false;
  }
}

async function readStorageEstimate(): Promise<StorageEstimate> {
  try {
    if (!navigator.storage?.estimate) return { status: "unavailable" };
    const { usage, quota } = await navigator.storage.estimate();
    return { status: "available", usage, quota };
  } catch {
    return { status: "error" };
  }
}

async function readPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

export async function collectEnvironmentReport(): Promise<EnvironmentReport> {
  const [storageEstimate, persistentStorage] = await Promise.all([
    readStorageEstimate(),
    readPersistentStorage(),
  ]);

  return {
    secureContext: window.isSecureContext === true,
    audioWorkletApi: typeof window.AudioContext === "function" && typeof window.AudioWorkletNode === "function",
    microphoneApi: typeof navigator.mediaDevices?.getUserMedia === "function",
    midiApi: typeof navigator.requestMIDIAccess === "function",
    indexedDbApi: hasIndexedDbApi(),
    crossOriginIsolated: window.crossOriginIsolated === true,
    storageEstimate,
    persistentStorage,
  };
}
