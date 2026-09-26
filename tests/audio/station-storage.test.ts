import { describe, expect, it } from "vitest";
import type { CachedLoop } from "../../src/audio/loop/loop-history";
import { recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { createLoopSession, digest, historyChecksum } from "../../src/audio/storage/loop-session";
import { createStationSession, decodeStationSession, emptyStationHistory } from "../../src/audio/storage/station-session";

function take(value = 0.125, bpm = 120, bars = 4): CachedLoop {
  const config = { bpm, numerator: 4, denominator: 4 };
  const capacity = recordingCapacity(8000, config, bars);
  return { pcm: new Float32Array(capacity).fill(value).buffer,
    metadata: { ...config, sampleRate: 8000, frames: capacity - 1, ticks: bars * 3840, complete: true } };
}

describe("versioned eight-track project", () => {
  it("migrates a v1 take and its Undo into track 01 without changing the old revision or PCM", async () => {
    const legacy = await createLoopSession({ current: take(0.25), undo: take(), redo: null, cleared: null });
    const migrated = await decodeStationSession(legacy);
    expect(migrated.revision).toBe(legacy.revision);
    expect(migrated.history.tracks).toHaveLength(8);
    expect(migrated.history.tracks[0]).toEqual(legacy.history);
    expect(migrated.history.tracks.slice(1).every((track) => track.current === null)).toBe(true);
    expect(legacy.schemaVersion).toBe(1);
    const saved = await createStationSession(migrated.history);
    expect(saved.revision).not.toBe(legacy.revision);
    expect((await decodeStationSession(structuredClone(saved))).history).toEqual(migrated.history);
  });
  it("round trips separate takes, Undo, and cleared history in all eight slots", async () => {
    const history = emptyStationHistory();
    history.forEach((track, index) => { track.current = take((index + 1) / 16); });
    history[2].undo = take();
    history[7] = { current: null, undo: null, redo: null, cleared: { current: take(0.75), undo: take(0.5), redo: null } };
    const saved = await createStationSession({ tracks: history, mixer: defaultStationMix(), master: defaultMasterMix() });
    expect((await decodeStationSession(structuredClone(saved))).history.tracks).toEqual(history);
  });
  it("detects cross-track swaps and corrupted PCM", async () => {
    const history = emptyStationHistory();
    history[0].current = take(0.25);
    history[1].current = take(0.5);
    const saved = await createStationSession({ tracks: history, mixer: defaultStationMix(), master: defaultMasterMix() });
    const swapped = structuredClone(saved);
    [swapped.history.tracks[0], swapped.history.tracks[1]] = [swapped.history.tracks[1], swapped.history.tracks[0]];
    await expect(decodeStationSession(swapped)).rejects.toMatchObject({ code: "corrupt" });
    new Float32Array(saved.history.tracks[1].current!.pcm)[0] = 0;
    await expect(decodeStationSession(saved)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("rejects incompatible tempos, missing tracks, and future formats", async () => {
    const history = emptyStationHistory();
    history[0].current = take();
    history[1].current = take(0.25, 100);
    await expect(createStationSession({ tracks: history, mixer: defaultStationMix(), master: defaultMasterMix() })).rejects.toMatchObject({ code: "corrupt" });
    await expect(createStationSession({ tracks: history.slice(1), mixer: defaultStationMix(), master: defaultMasterMix() })).rejects.toMatchObject({ code: "corrupt" });
    await expect(createStationSession({ tracks: new Array<never>(8), mixer: defaultStationMix(), master: defaultMasterMix() })).rejects.toMatchObject({ code: "corrupt" });
    await expect(decodeStationSession({ schemaVersion: 6 })).rejects.toMatchObject({ code: "version" });
  });
});

describe("variable recording lengths in schema v5", () => {
  it("round trips mixed lengths with matching Undo, incomplete PCM and cleared recovery", async () => {
    const tracks = emptyStationHistory();
    [1, 2, 4, 8].forEach((bars, index) => {
      tracks[index] = { current: take(0.25, 120, bars), undo: take(0.125, 120, bars), redo: null, cleared: null };
    });
    tracks[4].current = take(0.5, 120, 2);
    tracks[4].current.metadata = { ...tracks[4].current.metadata, complete: false, frames: 317 };
    tracks[4].cleared = { current: take(0.75, 120, 8), undo: null, redo: null };
    const project = { tracks, mixer: defaultStationMix(), master: defaultMasterMix() };
    const saved = await createStationSession(project);
    expect(saved.schemaVersion).toBe(5);
    expect((await decodeStationSession(structuredClone(saved))).history).toEqual(project);
  });

  it("verifies v4 checksums and migrates read-only without changing PCM, mixer or revision", async () => {
    const tracks = emptyStationHistory();
    tracks[0].current = take();
    tracks[0].undo = take(0.25);
    const mixer = defaultStationMix().map((mix) => ({ ...mix, pan: -0.5 }));
    const master = { gainDb: -9, mute: true };
    const hashes = await Promise.all(tracks.map(historyChecksum));
    const legacy = { schemaVersion: 4, revision: "v4-mix", updatedAt: 123, history: { tracks, mixer, master },
      checksum: await digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 4, tracks: hashes, mixer, master })).buffer) };
    const original = structuredClone(legacy);
    const migrated = await decodeStationSession(legacy);
    expect(migrated).toMatchObject({ schemaVersion: 5, revision: legacy.revision, updatedAt: legacy.updatedAt, history: legacy.history });
    expect(legacy).toEqual(original);
    const saved = await createStationSession(migrated.history);
    expect((await decodeStationSession(saved)).history).toEqual(legacy.history);
    legacy.history.master.mute = false;
    await expect(decodeStationSession(legacy)).rejects.toMatchObject({ code: "corrupt" });
  });

  it("rejects unsupported lengths, mismatched PCM capacity and Undo from another duration", async () => {
    const tracks = emptyStationHistory();
    tracks[0].current = take(0.25, 120, 2);
    const project = { tracks, mixer: defaultStationMix(), master: defaultMasterMix() };
    tracks[0].current.metadata.ticks = 3 * 3840;
    await expect(createStationSession(project)).rejects.toMatchObject({ code: "corrupt" });
    tracks[0].current.metadata.ticks = 8 * 3840;
    await expect(createStationSession(project)).rejects.toMatchObject({ code: "corrupt" });
    tracks[0].current = take(0.25, 120, 2);
    tracks[0].undo = take(0.125, 120, 1);
    await expect(createStationSession(project)).rejects.toMatchObject({ code: "corrupt" });
  });
});

describe("stereo mixer migration", () => {
  it("verifies v3 before adding centered pan and the previous 0.5 master gain", async () => {
    const tracks = emptyStationHistory();
    tracks[0].current = take();
    const mixer = Array.from({ length: 8 }, (_, index) => ({ gainDb: -index, mute: index === 2, solo: index === 7 }));
    const hashes = await Promise.all(tracks.map(historyChecksum));
    const legacy = { schemaVersion: 3, revision: "v3-mix", updatedAt: 99, history: { tracks, mixer },
      checksum: await digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 3, tracks: hashes, mixer })).buffer) };
    const original = structuredClone(legacy);
    const migrated = await decodeStationSession(legacy);
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.revision).toBe("v3-mix");
    expect(migrated.history.mixer).toEqual(mixer.map((track) => ({ ...track, pan: 0 })));
    expect(migrated.history.master).toEqual(defaultMasterMix());
    expect(legacy).toEqual(original);
    legacy.history.mixer[0].mute = true;
    await expect(decodeStationSession(legacy)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("round trips pan and master and rejects tampering, invalid pan and master", async () => {
    const project = { tracks: emptyStationHistory(),
      mixer: defaultStationMix().map((track, index) => ({ ...track, pan: index % 2 ? -1 : 1 })),
      master: { gainDb: -12, mute: true } };
    const saved = await createStationSession(project);
    expect((await decodeStationSession(structuredClone(saved))).history).toEqual(project);
    const changed = structuredClone(saved);
    changed.history.master = { gainDb: -6, mute: true };
    await expect(decodeStationSession(changed)).rejects.toMatchObject({ code: "corrupt" });
    const panChanged = structuredClone(saved);
    panChanged.history.mixer = panChanged.history.mixer.map((track) => ({ ...track, pan: 0 }));
    await expect(decodeStationSession(panChanged)).rejects.toMatchObject({ code: "corrupt" });
    for (const pan of [-1.01, 1.01, NaN, Infinity]) {
      await expect(createStationSession({ ...project, mixer: project.mixer.map((track) => ({ ...track, pan })) })).rejects.toMatchObject({ code: "corrupt" });
    }
    await expect(createStationSession({ ...project, master: { gainDb: Infinity, mute: false } })).rejects.toMatchObject({ code: "corrupt" });
  });
});


describe("mixer persistence and migration", () => {
  it("opens v2 read-only with unity gains, preserving revision, PCM and undo", async () => {
    const history = emptyStationHistory();
    history[1].current = take();
    history[1].undo = take(0.25);
    const hashes = await Promise.all(history.map(historyChecksum));
    const legacy = { schemaVersion: 2, revision: "legacy-v2", updatedAt: 42, history,
      checksum: await digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 2, tracks: hashes })).buffer) };
    const original = structuredClone(legacy);
    const migrated = await decodeStationSession(legacy);
    expect(migrated.history.tracks).toEqual(history);
    expect(migrated.history.mixer).toEqual(defaultStationMix());
    expect(migrated.revision).toBe("legacy-v2");
    expect(legacy).toEqual(original);
    legacy.checksum = "0".repeat(64);
    await expect(decodeStationSession(legacy)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("round trips mixer-only projects and detects settings tampering", async () => {
    const mixer = defaultStationMix().map((track, index) => ({ ...track, gainDb: index - 6, mute: index === 1, solo: index === 7 }));
    const history = { tracks: emptyStationHistory(), mixer, master: defaultMasterMix() };
    const saved = await createStationSession(history);
    expect((await decodeStationSession(structuredClone(saved))).history).toEqual(history);
    const corrupt = structuredClone(saved);
    corrupt.history.mixer = corrupt.history.mixer.map((track, index) => index === 0 ? { ...track, mute: true } : track);
    await expect(decodeStationSession(corrupt)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("rejects missing, sparse, non-finite and out-of-range mixer settings", async () => {
    const tracks = emptyStationHistory();
    for (const gainDb of [NaN, Infinity, -61, 7]) {
      const mixer = defaultStationMix().map((track) => ({ ...track, gainDb }));
      await expect(createStationSession({ tracks, mixer, master: defaultMasterMix() })).rejects.toMatchObject({ code: "corrupt" });
    }
    await expect(createStationSession({ tracks, mixer: [], master: defaultMasterMix() })).rejects.toMatchObject({ code: "corrupt" });
    await expect(createStationSession({ tracks, mixer: new Array<never>(8), master: defaultMasterMix() })).rejects.toMatchObject({ code: "corrupt" });
    const saved = await createStationSession({ tracks, mixer: defaultStationMix(), master: defaultMasterMix() });
    await expect(decodeStationSession({ ...saved, history: { tracks } })).rejects.toMatchObject({ code: "corrupt" });
  });
});
