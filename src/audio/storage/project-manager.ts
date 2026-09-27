import type { StationController } from "../loop/station-controller";
import type { TransportConfig } from "../transport/audio-frame-clock";
import { LEGACY_PROJECT_ID, ProjectCatalog, ProjectRepository, isProjectId, type ProjectSummary } from "./project-catalog";
import type { SavedStationSession } from "./station-session";

const SELECTION = "loop-station-active-project";
export const PROJECT_CHANNEL = "loop-station-project-catalog";
type ProjectOperation = "create" | "open" | "rename" | "duplicate" | null;
export type ProjectManagerSnapshot = {
  phase: "loading" | "ready" | "error"; projects: readonly ProjectSummary[];
  activeId: string; operation: ProjectOperation; issue: string | null; selectionIssue: string | null;
};
const initial: ProjectManagerSnapshot = { phase: "loading", projects: [], activeId: LEGACY_PROJECT_ID, operation: null, issue: null, selectionIssue: null };
function message(error: unknown): string {
  if (error instanceof Error && error.name === "QuotaExceededError") return "저장 공간이 부족합니다. 기존 프로젝트는 유지됩니다.";
  return error instanceof Error ? error.message : "프로젝트 작업에 실패했습니다. 기존 작업은 유지됩니다.";
}

export class ProjectManager {
  private snapshot = initial;
  private readonly listeners = new Set<() => void>();
  private initialization: Promise<void> | null = null;
  private listening = false;
  private stopStorage: (() => void) | null = null;
  private channel: BroadcastChannel | null = null;
  private listSequence = 0;
  constructor(private readonly station: StationController, private readonly catalog = new ProjectCatalog()) {}
  readonly getSnapshot = (): ProjectManagerSnapshot => this.snapshot;
  readonly getServerSnapshot = (): ProjectManagerSnapshot => initial;
  readonly subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ProjectManagerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  listen(): () => void {
    this.listening = true;
    this.bindStorage();
    let previousSave = this.station.getSnapshot().save;
    const unsubscribe = this.station.subscribe(() => {
      const save = this.station.getSnapshot().save;
      const changed = save !== previousSave;
      previousSave = save;
      if (changed && save.phase === "saved" && this.snapshot.phase === "ready" && !this.snapshot.operation) {
        void this.refresh();
        this.announce();
      }
    });
    try {
      this.channel = new BroadcastChannel(PROJECT_CHANNEL);
      this.channel.onmessage = () => { if (this.snapshot.phase === "ready") void this.refresh(); };
    } catch { /* CAS in the repository still detects competing writes. */ }
    return () => {
      this.listening = false;
      unsubscribe();
      this.stopStorage?.(); this.stopStorage = null;
      this.channel?.close(); this.channel = null;
    };
  }
  private bindStorage(): void {
    this.stopStorage?.();
    this.stopStorage = this.listening && this.snapshot.phase === "ready" ? this.station.listenForStorageChanges() : null;
  }
  private announce(): void { try { this.channel?.postMessage("changed"); } catch { /* Notification is advisory. */ } }
  initialize(): Promise<void> {
    if (this.snapshot.phase === "ready") return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.initialization = this.loadInitial().finally(() => { this.initialization = null; });
    return this.initialization;
  }
  private async loadInitial(): Promise<void> {
    this.update({ phase: "loading", issue: null });
    try {
      await this.catalog.registerLegacy();
      const projects = await this.catalog.list();
      let remembered: string | null = null;
      try { remembered = globalThis.sessionStorage?.getItem(SELECTION); } catch { /* Fall back to the most recently updated project. */ }
      const id = isProjectId(remembered) && projects.some((project) => project.id === remembered)
        ? remembered : projects[0]?.id ?? LEGACY_PROJECT_ID;
      if (!this.station.beginProjectChange(true)) throw new Error("현재 저장 작업이 끝난 뒤 다시 시도하세요.");
      const repository = new ProjectRepository(id);
      const saved = await repository.load();
      this.station.adoptProject(repository, saved);
      this.update({ phase: "ready", projects, activeId: id });
      this.bindStorage();
      this.remember(id);
    } catch (error) {
      this.station.cancelProjectChange();
      this.station.failProjectInitialization(error);
      this.update({ phase: "error", issue: message(error) });
    }
  }
  useSessionOnly(): void {
    this.station.useSessionOnly();
    if (this.station.getSnapshot().save.phase === "session") this.update({ phase: "ready", issue: null });
  }
  async refresh(clearIssue = false): Promise<void> {
    const sequence = ++this.listSequence;
    try {
      await this.catalog.registerLegacy();
      const projects = await this.catalog.list();
      if (sequence === this.listSequence) this.update({ projects, ...(clearIssue ? { issue: null } : {}) });
    } catch (error) {
      if (sequence === this.listSequence) this.update({ issue: message(error) });
    }
  }
  private remember(id: string): void {
    try { sessionStorage.setItem(SELECTION, id); this.update({ selectionIssue: null }); }
    catch { this.update({ selectionIssue: "프로젝트는 저장됐지만 이 탭의 선택을 기억하지 못했습니다. 새로고침 후 목록에서 다시 선택하세요." }); }
  }
  private canChange(): boolean {
    if (this.snapshot.phase !== "ready" || this.snapshot.operation) return false;
    const reason = this.station.projectChangeReason;
    if (reason) { this.update({ issue: reason }); return false; }
    return true;
  }
  private async change(operation: "create" | "open" | "duplicate", stopAudio: () => Promise<boolean>,
    prepare: () => Promise<{ id: string; saved: SavedStationSession }>): Promise<boolean> {
    if (!this.canChange() || !this.station.beginProjectChange()) return false;
    this.update({ operation, issue: null });
    let prepared = false;
    try {
      if (!await stopAudio()) throw new Error("오디오 종료에 실패했습니다. 상단 AUDIO에서 종료를 재시도한 뒤 다시 여세요.");
      const { id, saved } = await prepare();
      prepared = true;
      this.stopStorage?.(); this.stopStorage = null;
      this.station.adoptProject(new ProjectRepository(id), saved);
      this.bindStorage();
      this.update({ activeId: id });
      this.remember(id);
      this.announce();
      return true;
    } catch (error) {
      if (operation === "duplicate" && prepared) this.announce();
      this.update({ issue: operation === "duplicate" && prepared
        ? `사본은 저장됐지만 스튜디오를 전환하지 못했습니다. 목록에서 사본을 다시 여세요. ${message(error)}` : message(error) });
      return false;
    } finally {
      this.station.cancelProjectChange();
      this.bindStorage();
      this.update({ operation: null });
      await this.refresh();
    }
  }
  create(title: string, config: TransportConfig, stopAudio: () => Promise<boolean>): Promise<boolean> {
    return this.change("create", stopAudio, async () => {
      const { project, saved } = await this.catalog.create(title, config);
      return { id: project.id, saved };
    });
  }
  duplicate(project: ProjectSummary, title: string, stopAudio: () => Promise<boolean>): Promise<boolean> {
    return this.change("duplicate", stopAudio, async () => {
      const copied = await this.catalog.duplicate(project, title, this.station.retainedBytes);
      return { id: copied.project.id, saved: copied.saved };
    });
  }
  open(id: string, stopAudio: () => Promise<boolean>): Promise<boolean> {
    if (id === this.snapshot.activeId) return Promise.resolve(this.snapshot.phase === "ready" && !this.snapshot.operation);
    return this.change("open", stopAudio, async () => {
      const saved = await new ProjectRepository(id).load();
      if (!saved) throw new Error("프로젝트를 찾을 수 없습니다. 목록을 새로고침하세요.");
      return { id, saved };
    });
  }
  async rename(project: ProjectSummary, title: string): Promise<boolean> {
    if (!this.canChange()) return false;
    this.update({ operation: "rename", issue: null });
    try {
      await this.catalog.rename(project, title);
      this.announce();
      return true;
    } catch (error) { this.update({ issue: message(error) }); return false; }
    finally { this.update({ operation: null }); await this.refresh(); }
  }
}
