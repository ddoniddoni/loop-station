import type { CachedLoop } from "../loop/loop-history";
import { encodeWav } from "./wav";

// Bundled as a dedicated Worker; never runs on the AudioWorklet rendering thread.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<CachedLoop>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
worker.onmessage = (event) => {
  try {
    const result = encodeWav(event.data, (progress) => worker.postMessage({ type: "progress", progress }));
    worker.postMessage({ type: "ready", ...result }, [result.wav]);
  } catch (error) {
    worker.postMessage({ type: "error", issue: error instanceof Error ? error.message : "WAV 파일 준비에 실패했습니다." });
  }
};
