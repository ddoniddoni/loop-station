import type { LoopHistoryState } from "../loop/loop-history";
import { LoopStorageError, type SessionRepository } from "./loop-session";

export type LoopSaveState = {
  phase: "loading" | "empty" | "saving" | "saved" | "error" | "conflict" | "session";
  issue: string | null;
  savedAt: number | null;
  savedAtLabel: string | null;
  editLocked: boolean;
  canRetry: boolean;
};
export const initialSaveState: LoopSaveState = { phase: "loading", issue: null, savedAt: null, savedAtLabel: null, editLocked: true, canRetry: false };
const CHANNEL = "loop-station-local-session";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "QuotaExceededError") return "브라우저 저장 공간이 부족합니다. 이전 저장본은 유지되며 새 변경은 이 탭에만 남아 있습니다.";
  if (error instanceof Error && error.name === "VersionError") return "더 새로운 저장소 버전입니다. 저장 없이 계속하거나 앱을 업데이트하세요.";
  if (error instanceof Error && error.name === "SecurityError") return "브라우저가 로컬 저장소 접근을 차단했습니다. 저장 권한을 확인하세요.";
  if (error instanceof DOMException) return "브라우저 저장소 작업에 실패했습니다. 이전 저장본은 변경하지 않았습니다. 다시 시도해 주세요.";
  return error instanceof Error ? error.message : "로컬 저장소를 사용할 수 없습니다. 이전 저장본은 변경하지 않았습니다.";
}

/** One operation at a time. Editing pauses while IDB owns a serialization copy. */
export class LoopPersistence<State = LoopHistoryState> {
  private state: LoopSaveState;
  private initialized = false;
  private operation: Promise<void> | null = null;
  private revision: string | null = null;
  private unsaved = false;
  private pending: State | null = null;
  private channel: BroadcastChannel | null = null;
  private externalChange = false;

  constructor(private readonly repository: SessionRepository<State> | null,
    private readonly hydrate: (state: State) => void, private readonly notify: () => void) {
    this.state = repository ? initialSaveState : { ...initialSaveState, phase: "session", editLocked: false };
  }
  get snapshot(): LoopSaveState { return this.state; }
  get dirty(): boolean { return this.unsaved; }

  initialize(): Promise<void> {
    if (!this.repository || this.state.phase === "session" || this.initialized) return Promise.resolve();
    if (this.operation) return this.operation;
    this.operation = this.load().finally(() => { this.operation = null; });
    return this.operation;
  }
  private async load(): Promise<void> {
    if (!this.repository) return;
    this.set({ phase: "loading", issue: null, editLocked: true, canRetry: false });
    try {
      const saved = await this.repository.load();
      this.revision = saved?.revision ?? null;
      if (saved) this.hydrate(saved.history);
      this.initialized = true;
      this.unsaved = false;
      if (this.externalChange) { this.conflict(); return; }
      this.set({ phase: saved ? "saved" : "empty", savedAt: saved?.updatedAt ?? null, editLocked: false, issue: null });
    } catch (error) {
      this.set({ phase: "error", issue: errorMessage(error), editLocked: true, canRetry: true });
    }
  }

  changed(history: State): void {
    this.pending = history;
    this.unsaved = true;
    if (this.state.phase === "session" || this.state.phase === "conflict") return;
    void this.flush();
  }
  retry(): Promise<void> {
    if (this.operation) return this.operation;
    if (!this.initialized) { this.externalChange = false; return this.initialize(); }
    return this.flush();
  }
  private flush(): Promise<void> {
    if (this.operation) return this.operation;
    if (!this.repository || !this.initialized || !this.pending || this.state.phase === "session" || this.state.phase === "conflict") return Promise.resolve();
    this.operation = this.save(this.pending).finally(() => { this.operation = null; });
    return this.operation;
  }
  private async save(history: State): Promise<void> {
    if (!this.repository) return;
    this.set({ phase: "saving", issue: null, editLocked: true, canRetry: false });
    try {
      const saved = await this.repository.save(history, this.revision);
      this.revision = saved.revision;
      this.pending = null;
      this.unsaved = false;
      // Broadcasting is advisory; only the atomic repository CAS authorizes a write.
      try { this.channel?.postMessage(saved.revision); } catch { /* Closed channels do not change a successful commit. */ }
      if (this.externalChange) { this.conflict(); return; }
      this.set({ phase: "saved", savedAt: saved.updatedAt, issue: null, editLocked: false });
    } catch (error) {
      if (this.externalChange || (error instanceof LoopStorageError && error.code === "conflict")) { this.conflict(); return; }
      this.set({ phase: "error", issue: errorMessage(error), editLocked: false, canRetry: true });
    }
  }

  useSessionOnly(): void {
    if (this.operation || (this.state.phase !== "error" && this.state.phase !== "conflict")) return;
    this.set({ phase: "session", issue: "이 탭의 변경은 저장하지 않습니다. 새로고침하면 마지막 저장본으로 돌아갑니다.", editLocked: false, canRetry: false });
  }
  listen(): () => void {
    if (!this.repository || typeof BroadcastChannel === "undefined") return () => {};
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel(CHANNEL); }
    catch { return () => {}; }
    this.channel = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (this.channel !== channel || typeof event.data !== "string" || event.data === this.revision || this.state.phase === "session") return;
      this.externalChange = true;
      // Finish an in-flight transaction first, then expose its actual outcome.
      if (!this.operation) this.conflict();
    };
    return () => {
      channel.close();
      if (this.channel === channel) this.channel = null;
    };
  }
  private conflict(): void {
    this.unsaved = true;
    this.set({ phase: "conflict", editLocked: true, canRetry: false,
      issue: "다른 탭에서 저장 내용이 바뀌었습니다. 이 탭의 루프는 유지합니다. 다시 불러오려면 새로고침하세요. 저장되지 않은 변경은 사라질 수 있습니다." });
  }
  private set(patch: Partial<LoopSaveState>): void {
    const savedAtLabel = patch.savedAt === undefined ? this.state.savedAtLabel
      : patch.savedAt === null ? null : new Date(patch.savedAt).toLocaleTimeString("ko-KR");
    this.state = { ...this.state, ...patch, savedAtLabel };
    this.notify();
  }
}
