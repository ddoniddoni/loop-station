import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { StationController } from "../../src/audio/loop/station-controller";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { LEGACY_PROJECT_ID, ProjectCatalog, ProjectRepository, projectTitle, type ProjectSummary } from "../../src/audio/storage/project-catalog";
import { ProjectManager } from "../../src/audio/storage/project-manager";
import { createStationSession, emptyStationHistory, type SavedStationSession } from "../../src/audio/storage/station-session";

const otherId = "loop-00000000-0000-4000-8000-000000000001";
const config = { bpm: 90, numerator: 3, denominator: 4 };
async function saved(bpm = 120) {
  return createStationSession({ tracks: emptyStationHistory(), mixer: defaultStationMix(), master: defaultMasterMix(), transport: { bpm, numerator: 4, denominator: 4 } });
}
function summary(id: string, audio: SavedStationSession): ProjectSummary {
  return { id, title: id === LEGACY_PROJECT_ID ? "원래 작업" : "새 작업", revision: "metadata-v1", audioRevision: audio.revision,
    createdAt: audio.updatedAt, updatedAt: audio.updatedAt, updatedAtLabel: "saved", clipCount: 0, transport: audio.history.transport! };
}
async function fixture() {
  const original = await saved();
  const other = await saved(90);
  const input = new MicrophoneController();
  const projects = new Map([[LEGACY_PROJECT_ID, original], [otherId, other]]);
  vi.spyOn(ProjectRepository.prototype, "load").mockImplementation(async function (this: ProjectRepository) {
    const value = projects.get(this.id);
    if (!value) throw new Error("프로젝트를 찾을 수 없습니다.");
    return value;
  });
  vi.spyOn(ProjectRepository.prototype, "save").mockImplementation(async function (this: ProjectRepository, history) {
    const value = await createStationSession(history); projects.set(this.id, value); return value;
  });
  const catalog = new ProjectCatalog();
  vi.spyOn(catalog, "registerLegacy").mockResolvedValue();
  vi.spyOn(catalog, "list").mockImplementation(async () => [...projects].map(([id, value]) => summary(id, value)));
  const station = new StationController(input, new ProjectRepository(LEGACY_PROJECT_ID));
  const manager = new ProjectManager(station, catalog);
  await manager.initialize();
  return { manager, station, catalog, projects, original, other };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("safe project transitions", () => {
  it("restores the initial project without starting audio", async () => {
    const { manager, station, original } = await fixture();
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(station.getSnapshot().save.savedAt).toBe(original.updatedAt);
    expect(station.getSnapshot().config?.bpm).toBe(120);
    expect(station.tracks.every((track) => !track.getSnapshot().connected)).toBe(true);
  });
  it("changes project only after audio closes, preserving the previous saved data", async () => {
    const { manager, station, projects, original } = await fixture();
    const stop = vi.fn(async () => true);
    expect(await manager.open(otherId, stop)).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(station.getSnapshot().config?.bpm).toBe(90);
    expect(manager.getSnapshot().activeId).toBe(otherId);
    expect(projects.get(LEGACY_PROJECT_ID)).toBe(original);
    expect(station.projectChanging).toBe(false);
  });
  it("retains the old project when audio cannot close", async () => {
    const { manager, station, original } = await fixture();
    expect(await manager.open(otherId, async () => false)).toBe(false);
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(station.getSnapshot().save.savedAt).toBe(original.updatedAt);
    expect(station.getSnapshot().config?.bpm).toBe(120);
    expect(station.getSnapshot().save.editLocked).toBe(false);
  });
  it("retains the old project if the target is missing or corrupt", async () => {
    const { manager, station, projects } = await fixture();
    projects.delete(otherId);
    expect(await manager.open(otherId, async () => true)).toBe(false);
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(station.getSnapshot().config?.bpm).toBe(120);
  });
  it("locks capture and tempo while loading and rejects duplicate transitions", async () => {
    const { manager, station, other } = await fixture();
    let resolve!: (value: SavedStationSession) => void;
    vi.spyOn(ProjectRepository.prototype, "load").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const opening = manager.open(otherId, async () => true);
    await Promise.resolve();
    expect(station.getSnapshot().save.editLocked).toBe(true);
    station.configureProject(config);
    expect(station.getSnapshot().config?.bpm).toBe(120);
    expect(await manager.open(otherId, async () => true)).toBe(false);
    resolve(other);
    expect(await opening).toBe(true);
    expect(station.getSnapshot().save.editLocked).toBe(false);
  });
  it("blocks transitions when a save failed, preserving unsaved tempo", async () => {
    const { manager, station } = await fixture();
    vi.spyOn(ProjectRepository.prototype, "save").mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    station.configureProject(config);
    await station.retryStorage();
    const stop = vi.fn(async () => true);
    expect(await manager.open(otherId, stop)).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(station.dirty).toBe(true);
    expect(station.getSnapshot().config).toEqual(config);
  });
  it("keeps the active project after a failed creation", async () => {
    const { manager, station, catalog } = await fixture();
    vi.spyOn(catalog, "create").mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    expect(await manager.create("새 곡", config, async () => true)).toBe(false);
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(station.getSnapshot().config?.bpm).toBe(120);
    expect(station.projectChanging).toBe(false);
  });
  it("retries initialization after a storage failure", async () => {
    const { station, catalog } = await fixture();
    const fresh = new StationController(new MicrophoneController(), new ProjectRepository(LEGACY_PROJECT_ID));
    const manager = new ProjectManager(fresh, catalog);
    vi.spyOn(catalog, "list").mockRejectedValueOnce(new Error("storage blocked"));
    await manager.initialize();
    expect(manager.getSnapshot().phase).toBe("error");
    await manager.initialize();
    expect(manager.getSnapshot().phase).toBe("ready");
    expect(fresh.getSnapshot().config).toEqual(station.getSnapshot().config);
  });
  it("locks edits and waits for duplication to commit before selecting the independent copy", async () => {
    const { manager, station, catalog, projects, other, original } = await fixture();
    let finish!: () => void;
    const duplicate = vi.spyOn(catalog, "duplicate").mockImplementation(() => new Promise((resolve) => {
      finish = () => { projects.set(otherId, other); resolve({ project: summary(otherId, other), saved: other }); };
    }));
    const source = manager.getSnapshot().projects.find((item) => item.id === LEGACY_PROJECT_ID)!;
    const stop = vi.fn(async () => true);
    const pending = manager.duplicate(source, "사본", stop);
    await Promise.resolve();
    expect(stop).toHaveBeenCalledOnce();
    expect(manager.getSnapshot().operation).toBe("duplicate");
    expect(station.projectChanging).toBe(true);
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(await manager.duplicate(source, "두 번째 사본", stop)).toBe(false);
    expect(duplicate).toHaveBeenCalledExactlyOnceWith(source, "사본", 0);
    finish();
    expect(await pending).toBe(true);
    expect(manager.getSnapshot().activeId).toBe(otherId);
    expect(station.projectChanging).toBe(false);
    expect(station.getSnapshot().config?.bpm).toBe(90);
    expect(projects.get(LEGACY_PROJECT_ID)).toBe(original);
    expect(station.tracks.every((track) => !track.getSnapshot().connected)).toBe(true);
  });
  it("keeps the current project and unlocks editing when duplication fails", async () => {
    const { manager, station, catalog, original } = await fixture();
    vi.spyOn(catalog, "duplicate").mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    const source = manager.getSnapshot().projects[0];
    expect(await manager.duplicate(source, "사본", async () => true)).toBe(false);
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(manager.getSnapshot().issue).toContain("저장 공간");
    expect(station.getSnapshot().save.savedAt).toBe(original.updatedAt);
    expect(station.projectChanging).toBe(false);
  });
  it("does not start duplication when audio cannot close or current edits are unsaved", async () => {
    const { manager, station, catalog } = await fixture();
    const duplicate = vi.spyOn(catalog, "duplicate");
    const source = manager.getSnapshot().projects[0];
    expect(await manager.duplicate(source, "사본", async () => false)).toBe(false);
    vi.spyOn(ProjectRepository.prototype, "save").mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    station.configureProject(config);
    await station.retryStorage();
    const stop = vi.fn(async () => true);
    expect(await manager.duplicate(source, "사본", stop)).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(duplicate).not.toHaveBeenCalled();
    expect(station.dirty).toBe(true);
  });
  it("distinguishes a committed copy from a subsequent activation failure", async () => {
    const { manager, station, catalog, other } = await fixture();
    vi.spyOn(catalog, "duplicate").mockResolvedValue({ project: summary(otherId, other), saved: other });
    vi.spyOn(station, "adoptProject").mockImplementation(() => { throw new Error("다른 탭의 변경을 확인하세요."); });
    expect(await manager.duplicate(manager.getSnapshot().projects[0], "사본", async () => true)).toBe(false);
    expect(manager.getSnapshot().activeId).toBe(LEGACY_PROJECT_ID);
    expect(manager.getSnapshot().issue).toContain("사본은 저장됐지만");
    expect(station.projectChanging).toBe(false);
  });
});

describe("project names", () => {
  it("trims a valid name without discarding Korean or emoji", () => {
    expect(projectTitle("  새 곡 🎵  ")).toBe("새 곡 🎵");
  });
  it.each(["", "   ", "a".repeat(81), "hello\nworld"])("rejects invalid name %j", (name) => {
    expect(() => projectTitle(name)).toThrow();
  });
});

describe("project-scoped conflict notifications", () => {
  it("uses independent channels for separate projects and retains the legacy channel", () => {
    const names: string[] = [];
    const close = vi.fn();
    vi.stubGlobal("BroadcastChannel", class {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      constructor(name: string) { names.push(name); }
      close = close;
    });
    const legacy = new StationController(new MicrophoneController(), new ProjectRepository(LEGACY_PROJECT_ID));
    const other = new StationController(new MicrophoneController(), new ProjectRepository(otherId));
    const endLegacy = legacy.listenForStorageChanges();
    const endOther = other.listenForStorageChanges();
    expect(names).toEqual(["loop-station-local-session", `loop-station-local-session:${otherId}`]);
    endLegacy(); endOther();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
