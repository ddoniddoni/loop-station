import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { StationController } from "../../src/audio/loop/station-controller";
import { recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { createStationSession, emptyStationHistory, type StationProject } from "../../src/audio/storage/station-session";
import type { SessionRepository } from "../../src/audio/storage/loop-session";
import type { OutputMeterSnapshot } from "../../src/audio/loop/output-meter";

const config = { bpm: 120, numerator: 4, denominator: 4 };
const metadata = { ...config, sampleRate: 8000, frames: 64000, ticks: 15360, complete: true };
function fixture(repository: SessionRepository<StationProject> | null = null, rate = 8000) {
  const input = new MicrophoneController();
  vi.spyOn(input, "getSnapshot").mockReturnValue({ ...input.getSnapshot(), phase: "active", routed: true });
  const station = new StationController(input, repository);
  const messages: { type: string; trackId: number; sequence: number }[] = [];
  const port = { postMessage(message: { type: string; trackId: number; sequence: number }, transfer: Transferable[] = []) {
    messages.push(structuredClone(message, { transfer }));
  } };
  station.attach({ state: "running", sampleRate: rate } as AudioContext, { port } as unknown as AudioWorkletNode);
  station.accept({ type: "station-mixer-applied", sequence: messages.at(-1)!.sequence });
  messages.length = 0;
  station.acceptTransport({ type: "transport", ...config, playing: true, positionFrame: 0, positionTick: 0, contextFrame: 0 });
  function captured(trackId: number, sequence: number) {
    station.accept({ type: "loop-captured", trackId, sequence, captureMode: "record", metadata,
      pcm: new Float32Array(recordingCapacity(8000, config)).fill(0.25).buffer });
    station.accept({ type: "loop-status", trackId, sequence, phase: "playing", captureMode: null,
      recordedFrames: 64000, totalFrames: 64000, position: 0, pendingPlay: false, pendingPlayback: null, issue: null });
  }
  return { station, input, messages, captured };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("project-wide coordination", () => {
  it("keeps recording lengths independent and locks other selectors during capture", async () => {
    const f = fixture();
    f.station.tracks[0].setRecordBars(1);
    f.station.tracks[1].setRecordBars(8);
    expect(f.station.tracks.map((track) => track.getSnapshot().recordBars)).toEqual([1, 8, 4, 4, 4, 4, 4, 4]);
    await f.station.tracks[0].record();
    f.station.tracks[1].setRecordBars(2);
    expect(f.station.tracks[1].getSnapshot().recordBars).toBe(8);
    f.station.tracks[0].cancel();
    f.station.tracks[1].setRecordBars(2);
    expect(f.station.tracks[1].getSnapshot().recordBars).toBe(2);
  });

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
    const save = vi.fn<SessionRepository<StationProject>["save"]>(() => new Promise((yes) => { resolve = yes; }));
    const f = fixture({ load: async () => null, save });
    await f.station.initializeStorage();
    await f.station.tracks[3].record();
    f.captured(3, f.messages.at(-1)!.sequence);
    const history = save.mock.calls[0][0];
    expect(history.tracks).toHaveLength(8);
    expect(history.tracks[3].current?.metadata).toEqual(metadata);
    expect(history.tracks[0].current).toBeNull();
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
    const saved = await createStationSession({ tracks: history, mixer: defaultStationMix(), master: defaultMasterMix() });
    const f = fixture({ load: async () => saved, save: vi.fn() }, 48000);
    await f.station.initializeStorage();
    const count = f.messages.length;
    await f.station.tracks[0].record();
    expect(f.messages).toHaveLength(count);
    expect(f.station.tracks[0].getSnapshot().workspaceIssue).toContain("샘플레이트");
    expect(f.station.tracks[2].historyState.current?.pcm.byteLength).toBeGreaterThan(0);
  });
});

describe("master controls and live meter isolation", () => {
  it("persists master and pan together and rejects invalid values", async () => {
    const save = vi.fn<SessionRepository<StationProject>["save"]>((history) => createStationSession(history));
    const station = new StationController(new MicrophoneController(), { load: async () => null, save });
    await station.initializeStorage();
    station.setTrackMix(0, { pan: -0.75 });
    station.setMasterMix({ gainDb: -12, mute: true });
    station.setTrackMix(1, { pan: 2 });
    station.setMasterMix({ gainDb: NaN });
    station.commitMixer();
    await station.retryStorage();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].mixer[0].pan).toBe(-0.75);
    expect(save.mock.calls[0][0].mixer[1].pan).toBe(0);
    expect(save.mock.calls[0][0].master).toEqual({ gainDb: -12, mute: true });
  });
  it("publishes meters separately, rejects queued readings after reset, and clears on detach", () => {
    const f = fixture();
    const projectChanged = vi.fn();
    const meterChanged = vi.fn();
    f.station.subscribe(projectChanged); f.station.meters.subscribe(meterChanged);
    const level = { peak: 0.25, rms: 0.1, hold: 0.5, clipped: false };
    const reading: OutputMeterSnapshot = { type: "station-meter", sequence: 1, revision: 1,
      tracks: Array.from({ length: 8 }, () => level), left: level, right: level };
    f.station.accept(reading);
    expect(f.station.meters.getSnapshot()).toBe(reading);
    expect(meterChanged).toHaveBeenCalledOnce();
    expect(projectChanged).not.toHaveBeenCalled();
    expect(f.station.dirty).toBe(false);
    f.station.resetOutputMeters();
    f.station.accept(reading);
    expect(f.station.meters.getSnapshot()).toBeNull();
    f.station.accept({ ...reading, revision: 2 });
    expect(f.station.meters.getSnapshot()).not.toBeNull();
    f.station.detach();
    f.station.accept({ ...reading, revision: 2 });
    expect(f.station.meters.getSnapshot()).toBeNull();
  });
});

describe("mixer commands and atomic project persistence", () => {
  it("previews repeatedly, ignores stale acknowledgements and saves once after the latest acknowledgement", async () => {
    const save = vi.fn<SessionRepository<StationProject>["save"]>((history) => createStationSession(history));
    const f = fixture({ load: async () => null, save });
    await f.station.initializeStorage();
    f.station.setTrackMix(0, { gainDb: -3 });
    const old = f.messages.at(-1)!;
    f.station.setTrackMix(0, { gainDb: -6 });
    const latest = f.messages.at(-1)!;
    expect(save).not.toHaveBeenCalled();
    expect(f.station.dirty).toBe(true);
    f.station.commitMixer();
    f.station.accept({ type: "station-mixer-applied", sequence: old.sequence });
    expect(save).not.toHaveBeenCalled();
    f.station.accept({ type: "station-mixer-applied", sequence: latest.sequence });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].mixer[0].gainDb).toBe(-6);
    await f.station.retryStorage();
    expect(f.station.getSnapshot().save.phase).toBe("saved");
    expect(f.station.dirty).toBe(false);
  });
  it("restores settings before audio starts, then reapplies them to a new Worklet", async () => {
    const mixer = defaultStationMix().map((track, index) => ({ ...track, gainDb: -12, mute: index === 0, solo: index === 7 }));
    const saved = await createStationSession({ tracks: emptyStationHistory(), mixer, master: defaultMasterMix() });
    const station = new StationController(new MicrophoneController(), { load: async () => saved, save: vi.fn() });
    await station.initializeStorage();
    expect(station.getSnapshot().mixer).toEqual(mixer);
    expect(station.getSnapshot().mixerPending).toBe(false);
    const postMessage = vi.fn();
    const node = { port: { postMessage } } as unknown as AudioWorkletNode;
    station.attach({ state: "running", sampleRate: 8000 } as AudioContext, node);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "station-mixer", mix: mixer }));
    expect(station.getSnapshot().mixerPending).toBe(true);
    station.detach();
    expect(station.getSnapshot().mixer).toEqual(mixer);
  });
  it("retains failed mixer saves for retry, without accepting edits during the write", async () => {
    let reject!: (reason: Error) => void;
    const save = vi.fn<SessionRepository<StationProject>["save"]>()
      .mockImplementationOnce(() => new Promise((_, no) => { reject = no; }))
      .mockImplementation((history) => createStationSession(history));
    const station = new StationController(new MicrophoneController(), { load: async () => null, save });
    await station.initializeStorage();
    station.setTrackMix(7, { solo: true });
    station.commitMixer();
    station.setTrackMix(0, { mute: true });
    expect(station.getSnapshot().mixer[0].mute).toBe(false);
    reject(new DOMException("Quota", "QuotaExceededError"));
    await station.retryStorage();
    expect(station.getSnapshot().save.phase).toBe("error");
    expect(station.dirty).toBe(true);
    await station.retryStorage();
    expect(save.mock.calls[1][0].mixer[7].solo).toBe(true);
    expect(save.mock.calls[1][1]).toBeNull();
    expect(station.getSnapshot().save.phase).toBe("saved");
  });
  it("rejects changes while storage loads or a capture is active, and rejects invalid gains", async () => {
    const f = fixture({ load: async () => null, save: vi.fn() });
    f.station.setTrackMix(0, { mute: true });
    expect(f.station.getSnapshot().mixer[0].mute).toBe(false);
    await f.station.initializeStorage();
    f.station.setTrackMix(0, { gainDb: Infinity });
    f.station.setTrackMix(8, { mute: true });
    expect(f.station.getSnapshot().mixer).toEqual(defaultStationMix());
    await f.station.tracks[0].record();
    f.station.setTrackMix(1, { solo: true });
    expect(f.station.getSnapshot().mixer[1].solo).toBe(false);
  });
});
