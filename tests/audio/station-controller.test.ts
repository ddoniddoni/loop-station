import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { StationController } from "../../src/audio/loop/station-controller";
import { recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { createStationSession, emptyStationHistory, type StationHistory } from "../../src/audio/storage/station-session";
import type { SessionRepository } from "../../src/audio/storage/loop-session";

const config = { bpm: 120, numerator: 4, denominator: 4 };
const metadata = { ...config, sampleRate: 8000, frames: 64000, ticks: 15360, complete: true };
function fixture(repository: SessionRepository<StationHistory> | null = null, rate = 8000) {
  const input = new MicrophoneController();
  vi.spyOn(input, "getSnapshot").mockReturnValue({ ...input.getSnapshot(), phase: "active", routed: true });
  const station = new StationController(input, repository);
  const messages: { type: string; trackId: number; sequence: number }[] = [];
  const port = { postMessage(message: { type: string; trackId: number; sequence: number }, transfer: Transferable[] = []) {
    messages.push(structuredClone(message, { transfer }));
  } };
  station.attach({ state: "running", sampleRate: rate } as AudioContext, { port } as unknown as AudioWorkletNode);
  station.acceptTransport({ type: "transport", ...config, playing: true, positionFrame: 0, positionTick: 0, contextFrame: 0 });
  function captured(trackId: number, sequence: number) {
    station.accept({ type: "loop-captured", trackId, sequence, captureMode: "record", metadata,
      pcm: new Float32Array(recordingCapacity(8000, config)).fill(0.25).buffer });
    station.accept({ type: "loop-status", trackId, sequence, phase: "playing", captureMode: null,
      recordedFrames: 64000, totalFrames: 64000, position: 0, pendingPlay: false, issue: null });
  }
  return { station, input, messages, captured };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("project-wide coordination", () => {
  it("locks other captures, isolates a foreign acknowledgement, then releases the next track", async () => {
    const f = fixture();
    await f.station.tracks[0].record();
    const command = f.messages.at(-1)!;
    await f.station.tracks[1].record();
    expect(f.messages).toHaveLength(1);
    expect(f.station.tracks[1].getSnapshot().blockedByTrack).toBe(0);
    f.captured(1, command.sequence);
    expect(f.station.tracks[1].getSnapshot().hasClip).toBe(false);
    expect(f.station.getSnapshot().performing).toBe(true);
    f.captured(0, command.sequence);
    expect(f.station.tracks[0].getSnapshot().hasClip).toBe(true);
    expect(f.station.tracks[1].getSnapshot().blockedByTrack).toBeNull();
    await f.station.tracks[1].record();
    expect(f.messages.at(-1)).toMatchObject({ type: "loop-record", trackId: 1 });
  });
  it("holds the project edit lock during asynchronous storage preflight and cancels cleanly", async () => {
    let resolve!: (value: StorageEstimate) => void;
    vi.stubGlobal("navigator", { storage: { estimate: () => new Promise<StorageEstimate>((yes) => { resolve = yes; }) } });
    const f = fixture({ load: async () => null, save: vi.fn() });
    await f.station.initializeStorage();
    const pending = f.station.tracks[7].record();
    await f.station.tracks[0].record();
    expect(f.station.tracks[0].getSnapshot().blockedByTrack).toBe(7);
    f.station.tracks[7].cancel();
    resolve({ quota: 1024 ** 3, usage: 0 });
    await pending;
    expect(f.messages).toHaveLength(0);
    expect(f.station.getSnapshot().performing).toBe(false);
    expect(f.station.tracks[0].getSnapshot().blockedByTrack).toBeNull();
  });
  it("saves all histories together and blocks another edit until that write commits", async () => {
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) } });
    let resolve!: (value: Awaited<ReturnType<typeof createStationSession>>) => void;
    const save = vi.fn<SessionRepository<StationHistory>["save"]>(() => new Promise((yes) => { resolve = yes; }));
    const f = fixture({ load: async () => null, save });
    await f.station.initializeStorage();
    await f.station.tracks[3].record();
    f.captured(3, f.messages.at(-1)!.sequence);
    const history = save.mock.calls[0][0];
    expect(history).toHaveLength(8);
    expect(history[3].current?.metadata).toEqual(metadata);
    expect(history[0].current).toBeNull();
    expect(f.station.tracks[0].getSnapshot().save.editLocked).toBe(true);
    const count = f.messages.length;
    await f.station.tracks[0].record();
    expect(f.messages).toHaveLength(count);
    resolve(await createStationSession(history));
    await f.station.retryStorage();
    expect(f.station.getSnapshot().save.phase).toBe("saved");
    expect(f.station.dirty).toBe(false);
  });
  it("blocks empty-track recording when a restored project has a different sample rate", async () => {
    const history = emptyStationHistory();
    history[2].current = { metadata, pcm: new ArrayBuffer(recordingCapacity(8000, config) * 4) };
    const saved = await createStationSession(history);
    const f = fixture({ load: async () => saved, save: vi.fn() }, 48000);
    await f.station.initializeStorage();
    const count = f.messages.length;
    await f.station.tracks[0].record();
    expect(f.messages).toHaveLength(count);
    expect(f.station.tracks[0].getSnapshot().workspaceIssue).toContain("샘플레이트");
    expect(f.station.tracks[2].historyState.current?.pcm.byteLength).toBeGreaterThan(0);
  });
});
