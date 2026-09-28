import type { CachedLoop } from "../loop/loop-history";
import { isLoopMetadata, isRecordBars, loopBars, recordingCapacity } from "../loop/loop-protocol";
import { STATION_MEMORY_BYTES } from "../loop/station-protocol";

export const WAV_HEADER_BYTES = 68; // WAVEFORMATEXTENSIBLE, PCM24, mono front-center.
export function wavSize(take: CachedLoop): number {
  if (!take || !(take.pcm instanceof ArrayBuffer) || !isLoopMetadata(take.metadata) || !take.metadata.complete) throw new Error("완료된 루프만 WAV로 내보낼 수 있습니다.");
  const meta = take.metadata;
  const bars = loopBars(meta);
  if (!isRecordBars(bars) || meta.sampleRate < 8000 || meta.sampleRate > 192000) throw new Error("지원하지 않는 루프 길이 또는 샘플레이트입니다.");
  const capacity = recordingCapacity(meta.sampleRate, meta, bars);
  if (take.pcm.byteLength !== capacity * 4 || Math.abs(meta.frames - (capacity - 1)) > 1) throw new Error("녹음 프레임과 PCM 크기가 일치하지 않습니다.");
  const data = meta.frames * 3;
  const size = WAV_HEADER_BYTES + data + data % 2;
  if (!Number.isSafeInteger(size) || size - 8 > 0xffff_ffff || size * 2 + take.pcm.byteLength > STATION_MEMORY_BYTES) throw new Error("WAV 파일이 내보내기 크기 한도를 넘었습니다.");
  return size;
}
export function checkWavMemory(take: CachedLoop, retainedBytes: number): number {
  const size = wavSize(take);
  // Main-thread history + live Worklet copy + worker input + output/Blob + overhead.
  if (!Number.isSafeInteger(retainedBytes) || retainedBytes < take.pcm.byteLength
    || retainedBytes * 2 + take.pcm.byteLength + size * 2 + 65536 > STATION_MEMORY_BYTES) throw new Error("WAV 준비에 필요한 메모리가 부족합니다. 원본 녹음은 유지됩니다.");
  return size;
}
export function wavFilename(title: string, trackId: number, sampleRate: number): string {
  const safe = Array.from(title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu, "_").replace(/^\.+|[.\s]+$/gu, "").trim()).slice(0, 40).join("") || "LoopStation";
  return `${safe}-track-${String(trackId + 1).padStart(2, "0")}-${sampleRate}Hz-24bit.wav`;
}
/** Worker-side PCM quantization. Original Float32 samples and history are untouched. */
export function encodeWav(take: CachedLoop, progress: (fraction: number) => void = () => {}): { wav: ArrayBuffer; clipped: number } {
  const wav = new ArrayBuffer(wavSize(take));
  const view = new DataView(wav);
  const ascii = (offset: number, text: string) => { for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index)); };
  const { frames, sampleRate } = take.metadata;
  ascii(0, "RIFF"); view.setUint32(4, wav.byteLength - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); view.setUint32(16, 40, true); view.setUint16(20, 0xfffe, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 3, true);
  view.setUint16(32, 3, true); view.setUint16(34, 24, true); view.setUint16(36, 22, true);
  view.setUint16(38, 24, true); view.setUint32(40, 4, true);
  view.setUint32(44, 1, true); view.setUint16(50, 0x10, true);
  new Uint8Array(wav, 52, 8).set([0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71]);
  ascii(60, "data"); view.setUint32(64, frames * 3, true);
  const pcm = new Float32Array(take.pcm, 0, frames);
  let clipped = 0;
  for (let index = 0; index < frames; index++) {
    const sample = pcm[index];
    if (!Number.isFinite(sample)) throw new Error("녹음에 유효하지 않은 샘플이 있습니다. 원본은 변경하지 않았습니다.");
    if (sample > 1 || sample < -1) clipped++;
    const quantized = Math.max(-8388608, Math.min(8388607, Math.round(sample * 8388608)));
    const offset = WAV_HEADER_BYTES + index * 3;
    view.setUint8(offset, quantized & 255); view.setUint8(offset + 1, (quantized >> 8) & 255); view.setUint8(offset + 2, (quantized >> 16) & 255);
    if ((index + 1) % 65536 === 0) progress((index + 1) / frames);
  }
  progress(1); return { wav, clipped };
}
