import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackWavExporter } from "../../src/audio/export/track-wav-exporter";
import { encodeWav } from "../../src/audio/export/wav";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { StationController } from "../../src/audio/loop/station-controller";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { LEGACY_PROJECT_ID, ProjectRepository } from "../../src/audio/storage/project-catalog";
import { createStationSession, emptyStationHistory } from "../../src/audio/storage/station-session";

class FakeWorker {
  static current: FakeWorker;
  constructor() { FakeWorker.current = this; }
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  respond(data: unknown) { this.onmessage?.({ data } as MessageEvent<unknown>); }
}
async function fixture() {
  vi.stubGlobal("Worker", FakeWorker);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:wav"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const tracks = emptyStationHistory();
  const take = { pcm: new Float32Array(8001).buffer, metadata: { bpm: 240, numerator: 4, denominator: 4, sampleRate: 8000, frames: 8000, ticks: 3840, complete: true } };
  tracks[0] = { current: take, undo: take, redo: null, cleared: null };
  const saved = await createStationSession({ tracks, mixer: defaultStationMix(), master: defaultMasterMix() });
  vi.spyOn(ProjectRepository.prototype, "load").mockResolvedValue(saved);
  const station = new StationController(new MicrophoneController(), new ProjectRepository(LEGACY_PROJECT_ID));
  await station.initializeStorage();
  return { station, exporter: new TrackWavExporter(station) };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("selected-track export lifecycle", () => {
  it("locks edits, clones input without transfer, and releases the URL only on close", async () => {
    const { station, exporter } = await fixture(); const original = station.tracks[0].historyState.current!;
    exporter.start(0, "song"); const worker = FakeWorker.current;
    expect(worker.postMessage).toHaveBeenCalledWith(original);
    expect(station.projectChanging).toBe(true); expect(station.beginProjectChange()).toBe(false);
    station.tracks[0].clear(); expect(station.tracks[0].historyState.current).toBe(original);
    worker.respond({ type: "ready", ...encodeWav(original) });
    expect(exporter.getSnapshot().phase).toBe("ready"); expect(worker.terminate).toHaveBeenCalledOnce();
    expect(station.projectChanging).toBe(true); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    exporter.cancel(); expect(station.projectChanging).toBe(false); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:wav");
    expect(original.pcm.byteLength).toBe(32004);
  });
  it("cancels and ignores stale results while a retry runs", async () => {
    const { station, exporter } = await fixture(); exporter.start(0, "song"); const old = FakeWorker.current;
    exporter.start(0, "duplicate"); expect(FakeWorker.current).toBe(old);
    exporter.cancel(); expect(old.terminate).toHaveBeenCalledOnce();
    exporter.start(0, "retry"); old.respond({ type: "error", issue: "late" });
    expect(exporter.getSnapshot().phase).toBe("encoding"); expect(station.projectChanging).toBe(true);
    exporter.cancel();
  });
  it("releases locks on worker failure and permits retry", async () => {
    const { station, exporter } = await fixture(); exporter.start(0, "song");
    FakeWorker.current.respond({ type: "ready", wav: new ArrayBuffer(1), clipped: 0 });
    expect(exporter.getSnapshot().phase).toBe("error"); expect(station.projectChanging).toBe(false);
    exporter.start(0, "retry"); expect(exporter.getSnapshot().phase).toBe("encoding"); exporter.cancel();
  });
  it("times out without changing recorded PCM", async () => {
    const { station, exporter } = await fixture(); const original = station.tracks[0].historyState.current;
    vi.useFakeTimers(); exporter.start(0, "song"); vi.advanceTimersByTime(30000);
    expect(exporter.getSnapshot().phase).toBe("error"); expect(station.projectChanging).toBe(false);
    expect(station.tracks[0].historyState.current).toBe(original);
  });
  it("rejects an empty track without acquiring the edit lock", async () => {
    const { station, exporter } = await fixture(); exporter.start(1, "song");
    expect(exporter.getSnapshot().phase).toBe("error"); expect(station.projectChanging).toBe(false);
  });
});
