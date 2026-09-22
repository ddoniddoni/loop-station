import type { MicrophoneController } from "../input/microphone-controller";
import { LoopPersistence, initialSaveState, type LoopSaveState } from "../storage/loop-persistence";
import type { SessionRepository } from "../storage/loop-session";
import { IndexedDbStationRepository, type StationHistory } from "../storage/station-session";
import type { TransportConfig, TransportSnapshot } from "../transport/audio-frame-clock";
import { LoopController, isCapturePhase } from "./loop-controller";
import { isTrackId, STATION_MEMORY_BYTES, TRACK_COUNT } from "./station-protocol";

type StationSnapshot = { save: LoopSaveState; performing: boolean; locked: boolean; config: TransportConfig | null; clipCount: number };
const initialSnapshot: StationSnapshot = { save: initialSaveState, performing: false, locked: true, config: null, clipCount: 0 };

/** Eight independent histories, one input owner, one atomic saved project. */
export class StationController {
  readonly tracks: readonly LoopController[];
  private readonly persistence: LoopPersistence<StationHistory>;
  private readonly listeners = new Set<() => void>();
  private snapshot = initialSnapshot;
  private activeTrack: number | null = null;
  private hydrating = false;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;

  constructor(private readonly input: MicrophoneController, repository: SessionRepository<StationHistory> | null = new IndexedDbStationRepository()) {
    this.persistence = new LoopPersistence(repository, (history) => {
      const config = history.flatMap((track) => [track.current, track.cleared?.current]).find((take) => take)?.metadata;
      if (config) this.node?.port.postMessage({ type: "transport-configure", config });
      this.hydrating = true;
      try { this.tracks.forEach((track, index) => track.hydrate(history[index])); }
      finally { this.hydrating = false; }
      this.refresh();
    }, () => this.refresh());
    this.tracks = Array.from({ length: TRACK_COUNT }, (_, trackId) => new LoopController(input, null, {
      trackId,
      getSave: () => this.persistence.snapshot,
      getActiveTrack: () => this.activeTrack,
      getRetainedBytes: () => this.tracks.reduce((sum, track) => sum + track.retainedBytes, 0),
      memoryLimit: STATION_MEMORY_BYTES,
      getIssue: () => {
        const rate = this.context?.sampleRate;
        return rate && this.tracks.some((track) => {
          const history = track.historyState;
          return [history.current, history.cleared?.current].some((take) => take && take.metadata.sampleRate !== rate);
        }) ? "저장된 프로젝트와 오디오 샘플레이트가 다릅니다. 원본은 보관 중이며 변환은 준비 중입니다." : null;
      },
      changed: () => this.persistence.changed(this.tracks.map((track) => track.historyState)),
      notify: () => this.refresh(),
    }));
    this.refresh();
  }

  readonly getSnapshot = (): StationSnapshot => this.snapshot;
  readonly getServerSnapshot = (): StationSnapshot => initialSnapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  get locked(): boolean { return this.snapshot.locked; }
  get dirty(): boolean { return this.persistence.dirty || this.tracks.some((track) => track.performing); }
  initializeStorage(): Promise<void> { return this.persistence.initialize(); }
  listenForStorageChanges(): () => void { return this.persistence.listen(); }
  retryStorage(): Promise<void> { return this.snapshot.performing ? Promise.resolve() : this.persistence.retry(); }
  useSessionOnly(): void { if (!this.snapshot.performing) this.persistence.useSessionOnly(); }
  attach(context: AudioContext, node: AudioWorkletNode): void {
    this.context = context;
    this.node = node;
    if (this.snapshot.config) node.port.postMessage({ type: "transport-configure", config: this.snapshot.config });
    this.tracks.forEach((track) => track.attach(context, node));
  }
  detach(): void { this.context = null; this.node = null; this.tracks.forEach((track) => track.detach()); }
  setRunning(running: boolean): void { this.tracks.forEach((track) => track.setRunning(running)); }
  stop(): void { this.tracks.forEach((track) => track.stop()); }
  acceptTransport(transport: TransportSnapshot): void { this.tracks.forEach((track) => track.acceptTransport(transport)); }
  accept(value: unknown): void {
    if (typeof value !== "object" || value === null || !("trackId" in value) || !isTrackId(value.trackId)) return;
    this.tracks[value.trackId].accept(value);
  }

  private refresh(): void {
    if (this.hydrating) return;
    const active = this.tracks.findIndex((track) => track.performing);
    const activeTrack = active < 0 ? null : active;
    const save = this.persistence.snapshot;
    const changed = activeTrack !== this.activeTrack || save !== this.snapshot.save;
    this.activeTrack = activeTrack;
    this.input.setCaptureLocked(this.tracks.some((track) => isCapturePhase(track.getSnapshot().phase)));
    if (changed) this.tracks.forEach((track) => track.refreshWorkspace());
    const clipCount = this.tracks.filter((track) => track.getSnapshot().hasClip).length;
    // Keep tempo fixed while a cleared take can still be restored.
    const config = this.tracks.map((track) => track.historyState).flatMap((history) => [history.current, history.cleared?.current])
      .find((take) => take)?.metadata ?? null;
    const locked = config !== null || activeTrack !== null || save.editLocked;
    if (save === this.snapshot.save && (activeTrack !== null) === this.snapshot.performing
      && clipCount === this.snapshot.clipCount && config === this.snapshot.config && locked === this.snapshot.locked) return;
    this.snapshot = { save, performing: activeTrack !== null, locked, config, clipCount };
    for (const listener of this.listeners) listener();
  }
}
