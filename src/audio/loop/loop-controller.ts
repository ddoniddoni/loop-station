import type { MicrophoneController } from "../input/microphone-controller";
import type { TransportSnapshot } from "../transport/audio-frame-clock";
import { LoopHistory, type CachedLoop, type HistoryDirection, type LoopHistoryState } from "./loop-history";
import { IndexedDbLoopRepository } from "../storage/indexed-db-loop-repository";
import { initialSaveState, LoopPersistence, type LoopSaveState } from "../storage/loop-persistence";
import type { LoopRepository } from "../storage/loop-session";
import { isLoopMetadata, isLoopStatus, LOOP_MEMORY_BYTES, recordingCapacity, type CaptureMode, type LoopMetadata, type LoopPhase, type LoopStatus } from "./loop-protocol";

export type LoopWorkspace = {
  trackId: number;
  getSave(): LoopSaveState;
  getActiveTrack(): number | null;
  getRetainedBytes(): number;
  readonly memoryLimit: number;
  getIssue(): string | null;
  changed(): void;
  notify(): void;
};

type PendingCapture = { mode: CaptureMode; sequence: number | null; generation: number };
type PendingHistory = { direction: HistoryDirection; target: CachedLoop; sequence: number };
export type LoopSnapshot = {
  phase: LoopPhase;
  captureMode: CaptureMode | null;
  connected: boolean;
  hasClip: boolean;
  canRestore: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyPending: HistoryDirection | null;
  metadata: LoopMetadata | null;
  progress: number;
  pendingPlay: boolean;
  issue: string | null;
  storageNote: string | null;
  save: LoopSaveState;
  blockedByTrack: number | null;
  workspaceIssue: string | null;
};
const initialSnapshot: LoopSnapshot = {
  phase: "empty", captureMode: null, connected: false, hasClip: false, canRestore: false,
  canUndo: false, canRedo: false, historyPending: null, metadata: null,
  progress: 0, pendingPlay: false, issue: null, storageNote: null,
  save: initialSaveState, blockedByTrack: null, workspaceIssue: null,
};

export function isCapturePhase(phase: LoopPhase): boolean {
  return phase === "preparing" || phase === "armed" || phase === "recording" || phase === "overdubbing";
}

async function checkStorage(bytes: number): Promise<string | null> {
  if (!navigator.storage?.estimate) return "저장 여유 공간을 미리 확인할 수 없습니다. 녹음 후 저장 상태를 확인하세요.";
  let estimate: StorageEstimate;
  try { estimate = await navigator.storage.estimate(); }
  catch { return "저장 공간 조회에 실패했습니다. 녹음 후 저장 상태를 확인하세요."; }
  if (estimate.quota === undefined || estimate.usage === undefined) return "저장 여유 공간을 확인할 수 없습니다. 녹음 후 저장 상태를 확인하세요.";
  if (estimate.quota - estimate.usage < bytes * 2) throw new Error("녹음에 필요한 저장 여유 공간이 부족합니다.");
  return null;
}

/** PCM ownership and persistence. React receives metadata and progress, never PCM. */
export class LoopController {
  private snapshot = initialSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly history = new LoopHistory();
  private readonly persistence: LoopPersistence;
  private node: AudioWorkletNode | null = null;
  private context: AudioContext | null = null;
  private transport: TransportSnapshot | null = null;
  private sequence = 0;
  private pendingCapture: PendingCapture | null = null;
  private pendingHistory: PendingHistory | null = null;
  private generation = 0;
  private bufferReady = true;
  private unsubscribeInput: (() => void) | null = null;

  constructor(private readonly input: MicrophoneController, repository: LoopRepository | null = new IndexedDbLoopRepository(), private readonly workspace?: LoopWorkspace) {
    this.persistence = new LoopPersistence(repository, (state) => this.hydrate(state), () => this.update({}));
    this.snapshot = { ...initialSnapshot, save: this.saveState };
  }

  get historyState(): LoopHistoryState { return this.history.snapshot(); }
  get retainedBytes(): number { return this.history.retainedBytes; }
  get performing(): boolean { return this.pendingCapture !== null || this.pendingHistory !== null || isCapturePhase(this.snapshot.phase); }
  private get saveState(): LoopSaveState { return this.workspace?.getSave() ?? this.persistence.snapshot; }
  private get blockedByTrack(): number | null {
    const active = this.workspace?.getActiveTrack() ?? null;
    return active === this.workspace?.trackId ? null : active;
  }
  refreshWorkspace(): void { this.update({}, false); }
  hydrate(state: LoopHistoryState): void {
    this.history.hydrate(state);
    this.update({ phase: this.idlePhase(), progress: 0, pendingPlay: false });
    this.sendCached();
  }
  private persist(): void {
    if (this.workspace) this.workspace.changed();
    else this.persistence.changed(this.history.snapshot());
  }

  initializeStorage(): Promise<void> { return this.persistence.initialize(); }
  listenForStorageChanges(): () => void { return this.persistence.listen(); }
  retryStorage(): Promise<void> {
    if (this.pendingCapture || this.pendingHistory || isCapturePhase(this.snapshot.phase)) return Promise.resolve();
    return this.persistence.retry();
  }
  useSessionOnly(): void { this.persistence.useSessionOnly(); }

  readonly getSnapshot = (): LoopSnapshot => this.snapshot;
  readonly getServerSnapshot = (): LoopSnapshot => initialSnapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  get locked(): boolean { return this.snapshot.hasClip || this.busy; }
  get dirty(): boolean { return this.persistence.dirty || this.pendingCapture !== null || this.pendingHistory !== null; }
  private get busy(): boolean { return this.workspace?.getIssue() != null || this.blockedByTrack !== null || this.saveState.editLocked || this.pendingCapture !== null || this.pendingHistory !== null || isCapturePhase(this.snapshot.phase); }

  attach(context: AudioContext, node: AudioWorkletNode): void {
    this.context = context;
    this.node = node;
    this.sequence = 0;
    this.pendingCapture = null;
    this.pendingHistory = null;
    this.bufferReady = !this.history.current;
    this.generation += 1;
    this.update({ connected: context.state === "running", issue: null, captureMode: null });
    this.unsubscribeInput = this.input.subscribe(() => {
      const input = this.input.getSnapshot();
      if (this.pendingCapture && (!input.routed || input.phase !== "active")) this.interrupt();
    });
    if (this.history.current) this.sendCached();
  }

  detach(): void {
    this.generation += 1;
    this.unsubscribeInput?.();
    this.unsubscribeInput = null;
    const interrupted = this.pendingCapture !== null;
    this.pendingCapture = null;
    this.pendingHistory = null;
    this.node = null;
    this.context = null;
    this.transport = null;
    this.update({ connected: false, phase: this.idlePhase(), captureMode: null, progress: 0, pendingPlay: false,
      issue: interrupted ? "오디오가 종료되어 미확정 녹음을 취소했습니다. 이전에 확정한 루프는 이 탭에 남아 있습니다." : this.snapshot.issue });
  }

  setRunning(running: boolean): void {
    if (!running) {
      this.interrupt();
      this.command("loop-stop");
      if (this.snapshot.phase === "playing") this.update({ phase: "stopped", progress: 0 });
    }
    this.update({ connected: running && this.bufferReady });
  }

  accept(value: unknown): void {
    if (!this.node || typeof value !== "object" || value === null || !("type" in value)) return;
    if (isLoopStatus(value)) { this.acceptStatus(value); return; }
    if (value.type === "loop-captured") { this.acceptCapture(value); return; }
    if (value.type === "loop-capture-aborted" && "sequence" in value && value.sequence === this.pendingCapture?.sequence) {
      this.pendingCapture = null;
      this.update({ captureMode: null });
      return;
    }
    this.acceptHistory(value);
  }

  private acceptStatus(value: LoopStatus): void {
    if (value.sequence !== this.sequence) return;
    // Old playback/empty snapshots must not unlock an asynchronous preflight.
    if (this.pendingCapture?.sequence === null) return;
    if (!isCapturePhase(value.phase)) this.pendingCapture = null;
    this.update({ phase: value.phase, captureMode: value.captureMode, progress: value.position,
      pendingPlay: value.pendingPlay, issue: value.issue });
  }

  private acceptCapture(value: object): void {
    const capture = this.pendingCapture;
    if (!capture || !("sequence" in value) || value.sequence !== capture.sequence
      || !("captureMode" in value) || value.captureMode !== capture.mode
      || !("metadata" in value) || !isLoopMetadata(value.metadata) || !("pcm" in value) || !(value.pcm instanceof ArrayBuffer)) return;
    if (value.pcm.byteLength < value.metadata.frames * 4 || value.pcm.byteLength > LOOP_MEMORY_BYTES / 2) return;
    this.history.commit({ pcm: value.pcm, metadata: value.metadata }, capture.mode);
    this.pendingCapture = null;
    this.update({ captureMode: null });
    this.persist();
  }

  private acceptHistory(value: object): void {
    const pending = this.pendingHistory;
    if (!pending || !("sequence" in value) || value.sequence !== pending.sequence || !("type" in value)) return;
    if (value.type === "loop-revision-applied") this.history.apply(pending.direction, pending.target);
    else if (value.type !== "loop-revision-cancelled" && value.type !== "loop-revision-rejected") return;
    this.pendingHistory = null;
    this.update({ issue: value.type === "loop-revision-rejected" ? "이력을 적용하지 못했습니다. 현재 루프는 유지됩니다." : null });
    if (value.type === "loop-revision-applied") this.persist();
  }

  acceptTransport(transport: TransportSnapshot): void { this.transport = transport; }

  async record(): Promise<void> {
    if (this.locked) return;
    await this.prepareCapture("record");
  }

  async overdub(): Promise<void> {
    if (this.busy || !this.history.current?.metadata.complete || this.snapshot.phase !== "playing" || this.snapshot.pendingPlay) return;
    await this.prepareCapture("overdub");
  }

  private async prepareCapture(mode: CaptureMode): Promise<void> {
    if (!this.context || !this.node || !this.transport || !this.snapshot.connected) return;
    const input = this.input.getSnapshot();
    if (!input.routed || input.phase !== "active") { this.update({ issue: "입력 설정에서 마이크를 먼저 연결하세요." }); return; }
    const capture: PendingCapture = { mode, sequence: null, generation: ++this.generation };
    const node = this.node;
    const config = this.transport;
    this.pendingCapture = capture;
    this.update({ phase: "preparing", captureMode: mode, issue: null, storageNote: null });
    try {
      const bytes = recordingCapacity(this.context.sampleRate, config) * Float32Array.BYTES_PER_ELEMENT;
      if (bytes * 4 + this.history.retainedBytes * 2 > LOOP_MEMORY_BYTES) throw new Error("32MiB 작업 메모리가 부족합니다. 기존 루프와 복구 이력은 유지됩니다.");
      if (this.workspace && bytes * 4 + this.workspace.getRetainedBytes() * 3 > this.workspace.memoryLimit) throw new Error("프로젝트의 128MiB 작업 메모리가 부족합니다. 다른 트랙과 복구 이력은 유지됩니다.");
      const storageNote = this.saveState.phase === "session" ? "저장 없이 연주 중입니다. 변경은 이 탭에만 남습니다." : await checkStorage(bytes + (this.workspace?.getRetainedBytes() ?? 0));
      if (capture.generation !== this.generation || node !== this.node) return;
      if (!this.snapshot.connected || !this.input.getSnapshot().routed) throw new Error("녹음 준비 중 입력 연결이 끊어졌습니다.");
      const pcm = new ArrayBuffer(bytes);
      const archive = new ArrayBuffer(bytes);
      capture.sequence = ++this.sequence;
      this.update({ phase: "armed", storageNote });
      node.port.postMessage({ trackId: this.workspace?.trackId, type: mode === "record" ? "loop-record" : "loop-overdub", sequence: capture.sequence, config, pcm, archive }, [pcm, archive]);
    } catch (error) {
      if (capture.generation !== this.generation) return;
      this.pendingCapture = null;
      this.update({ phase: mode === "overdub" ? "playing" : "empty", captureMode: null,
        issue: error instanceof Error ? error.message : "녹음 버퍼를 준비하지 못했습니다." });
    }
  }

  cancel(): void {
    const capture = this.pendingCapture;
    if (!capture) return;
    this.generation += 1;
    if (capture.sequence === null) {
      this.pendingCapture = null;
      this.update({ phase: capture.mode === "overdub" ? "playing" : "empty", captureMode: null, issue: null });
      return;
    }
    this.command("loop-cancel", capture.mode);
    // An overdub may have completed just before cancellation. Keep its ID until the audio thread acknowledges the result.
    if (capture.mode === "record") {
      this.pendingCapture = null;
      this.update({ phase: "empty", captureMode: null, progress: 0, issue: null });
    }
  }

  private interrupt(): void {
    if (!this.pendingCapture) return;
    if (this.pendingCapture.sequence === null) {
      this.cancel();
      this.update({ issue: "입력 또는 오디오 연결이 중단되어 녹음 준비를 취소했습니다." });
    } else {
      this.command("loop-interrupt");
    }
  }

  play(): void {
    if (!this.busy && this.history.current?.metadata.complete && this.snapshot.connected && this.snapshot.phase === "stopped") this.command("loop-play");
  }
  stop(): void {
    if (this.pendingCapture?.sequence === null) this.cancel();
    this.command("loop-stop");
  }

  clear(): void {
    if (!this.history.current || this.busy) return;
    this.history.clear();
    this.bufferReady = true;
    this.command("loop-clear");
    this.update({ phase: "empty", progress: 0, pendingPlay: false, issue: null, connected: this.context?.state === "running" });
    this.persist();
  }

  restore(): void {
    if (this.busy || !this.history.restore()) return;
    this.update({ phase: this.idlePhase(), issue: null });
    this.sendCached();
    this.persist();
  }

  changeHistory(direction: HistoryDirection): void {
    const target = this.history.target(direction);
    if (this.busy || !target || !this.node || !this.snapshot.connected) return;
    try {
      if (this.history.retainedBytes * 2 + target.pcm.byteLength > LOOP_MEMORY_BYTES) throw new Error("이력 복구에 필요한 메모리가 부족합니다.");
      if (this.workspace && this.workspace.getRetainedBytes() * 3 + target.pcm.byteLength > this.workspace.memoryLimit) throw new Error("프로젝트 이력 복구에 필요한 메모리가 부족합니다.");
      const pcm = target.pcm.slice(0);
      const sequence = ++this.sequence;
      this.pendingHistory = { direction, target, sequence };
      this.update({ issue: null });
      this.node.port.postMessage({ trackId: this.workspace?.trackId, type: "loop-revision", sequence, pcm, metadata: target.metadata }, [pcm]);
    } catch (error) {
      this.pendingHistory = null;
      this.update({ issue: error instanceof Error ? error.message : "이력을 준비하지 못했습니다." });
    }
  }

  cancelHistory(): void {
    if (this.pendingHistory) this.command("loop-cancel-revision");
  }

  private idlePhase(): LoopPhase {
    const current = this.history.current;
    return current ? (current.metadata.complete ? "stopped" : "incomplete") : "empty";
  }

  private sendCached(): void {
    const cached = this.history.current;
    if (!cached || !this.node || !this.context) return;
    this.bufferReady = false;
    if (cached.metadata.sampleRate !== this.context.sampleRate) {
      this.update({ connected: false, issue: "이 루프와 오디오 샘플레이트가 다릅니다. 원본은 보관 중이며 변환 재생은 아직 지원하지 않습니다." });
      return;
    }
    try {
      const pcm = cached.pcm.slice(0);
      this.node.port.postMessage({ trackId: this.workspace?.trackId, type: "loop-restore", sequence: ++this.sequence, pcm, metadata: cached.metadata }, [pcm]);
      this.bufferReady = true;
      this.update({ connected: this.context.state === "running" });
    } catch {
      this.update({ connected: false, issue: "재생 버퍼를 복구하지 못했습니다. 원본은 이 탭에 보관 중입니다." });
    }
  }

  private command(type: "loop-play" | "loop-stop" | "loop-clear" | "loop-cancel" | "loop-interrupt" | "loop-cancel-revision", captureMode?: CaptureMode): void {
    this.node?.port.postMessage({ trackId: this.workspace?.trackId, type, sequence: ++this.sequence, captureMode });
  }
  private update(patch: Partial<LoopSnapshot>, notifyWorkspace = true): void {
    this.snapshot = { ...this.snapshot, ...patch, hasClip: this.history.current !== null, metadata: this.history.current?.metadata ?? null,
      canUndo: this.history.canUndo, canRedo: this.history.canRedo, canRestore: this.history.canRestore,
      historyPending: this.pendingHistory?.direction ?? null, save: this.saveState, blockedByTrack: this.blockedByTrack, workspaceIssue: this.workspace?.getIssue() ?? null };
    if (!this.workspace) this.input.setCaptureLocked(isCapturePhase(this.snapshot.phase));
    for (const listener of this.listeners) listener();
    if (notifyWorkspace) this.workspace?.notify();
  }
}
