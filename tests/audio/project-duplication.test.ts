import { afterEach, describe, expect, it, vi } from "vitest";
import { STATION_MEMORY_BYTES } from "../../src/audio/loop/station-protocol";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { checkDuplicateCapacity, duplicateProjectTitle, projectPcmBytes } from "../../src/audio/storage/project-duplication";
import { emptyStationHistory, type StationProject } from "../../src/audio/storage/station-session";

function project(): StationProject {
  const tracks = emptyStationHistory();
  const take = { pcm: new ArrayBuffer(32_004), metadata: { bpm: 240, numerator: 4, denominator: 4, sampleRate: 8000, frames: 8000, ticks: 3840, complete: true } };
  tracks[0] = { current: take, undo: take, redo: null, cleared: null };
  tracks[1].cleared = { current: { ...take, pcm: new ArrayBuffer(32_004) }, undo: take, redo: null };
  return { tracks, mixer: defaultStationMix(), master: defaultMasterMix() };
}
afterEach(() => vi.unstubAllGlobals());

describe("project duplication capacity and names", () => {
  it("counts recovery audio, deduplicating within each track but reserving separate track copies", () => {
    expect(projectPcmBytes(project())).toBe(32_004 * 3);
  });
  it("accepts sufficient quota without changing source PCM or settings", async () => {
    const source = project();
    const before = structuredClone(source);
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) } });
    await checkDuplicateCapacity(source, 32_004);
    expect(source).toEqual(before);
  });
  it("rejects insufficient quota before writing a copy", async () => {
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 100, usage: 99 }) } });
    await expect(checkDuplicateCapacity(project(), 0)).rejects.toMatchObject({ name: "QuotaExceededError" });
  });
  it("reserves memory for the current project before querying storage", async () => {
    const estimate = vi.fn();
    vi.stubGlobal("navigator", { storage: { estimate } });
    await expect(checkDuplicateCapacity(project(), STATION_MEMORY_BYTES)).rejects.toThrow("메모리");
    expect(estimate).not.toHaveBeenCalled();
  });
  it.each([{}, { quota: Infinity, usage: 0 }, { quota: 100, usage: -1 }])("rejects unknown storage estimates %j", async (estimate) => {
    vi.stubGlobal("navigator", { storage: { estimate: async () => estimate } });
    await expect(checkDuplicateCapacity(project(), 0)).rejects.toThrow("저장 여유 공간");
  });
  it("reports unavailable estimation without silently skipping the preflight", async () => {
    vi.stubGlobal("navigator", {});
    await expect(checkDuplicateCapacity(project(), 0)).rejects.toThrow("저장 여유 공간");
  });
  it("keeps an 80-unit title valid and does not split an emoji surrogate pair", () => {
    const name = duplicateProjectTitle("가".repeat(75) + "🎵");
    expect(name).toBe("가".repeat(75) + " 사본");
    expect(name.length).toBeLessThanOrEqual(80);
    expect(duplicateProjectTitle("리듬 🎵")).toBe("리듬 🎵 사본");
  });
});
