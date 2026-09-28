import type { MicrophoneController } from "../input/microphone-controller";
import { LoopPersistence, initialSaveState, type LoopSaveState } from "../storage/loop-persistence";
import type { SessionRepository, StoredSession } from "../storage/loop-session";
import { IndexedDbStationRepository, emptyStationHistory, projectTransport, type StationProject } from "../storage/station-session";
import { isTransportConfig, type TransportConfig, type TransportSnapshot } from "../transport/audio-frame-clock";
import { LoopController, isCapturePhase } from "./loop-controller";
import { isTrackId, STATION_MEMORY_BYTES, TRACK_COUNT } from "./station-protocol";
import { defaultMasterMix, defaultStationMix, isMasterMix, isTrackMix, type MasterMix, type StationMix, type TrackMix } from "./track-mixer";
import { isOutputMeterSnapshot, OutputMeterStore } from "./output-meter";

type StationSnapshot = {
  save: LoopSaveState; performing: boolean; locked: boolean; config: TransportConfig | null; clipCount: number;
  mixer: StationMix; master: MasterMix; mixerPending: boolean; mixerDirty: boolean;
};
const initialSnapshot: StationSnapshot = { save: initialSaveState, performing: false, locked: true, config: null, clipCount: 0,
  mixer: defaultStationMix(), master: defaultMasterMix(), mixerPending: false, mixerDirty: false };

/** Eight independent histories, one input owner, one atomic saved project. */
export class StationController {
  readonly tracks: readonly LoopController[];
  readonly meters = new OutputMeterStore();
  private readonly persistence: LoopPersistence<StationProject>;
  private readonly listeners = new Set<() => void>();
  private snapshot = initialSnapshot;
  private activeTrack: number | null = null;
  private hydrating = false;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private mixer = defaultStationMix();
  private master = defaultMasterMix();
  private meterRevision = 0;
  private mixerSequence = 0;
  private mixerAppliedSequence = 0;
  private mixerDirty = false;
  private mixerCommitRequested = false;
  private projectTransport: TransportConfig = { bpm: 120, numerator: 4, denominator: 4 };

  constructor(private readonly input: MicrophoneController, repository: SessionRepository<StationProject> | null = new IndexedDbStationRepository()) {
    this.persistence = new LoopPersistence(repository, (project) => {
      const history = project.tracks;
      const config = projectTransport(project);
      this.projectTransport = config;
      if (config) this.node?.port.postMessage({ type: "transport-configure", config });
      this.hydrating = true;
      try { this.tracks.forEach((track, index) => track.hydrate(history[index])); }
      finally { this.hydrating = false; }
      this.mixer = project.mixer;
      this.master = project.master;
      this.sendMixer();
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
      changed: () => this.persistProject(),
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
  get retainedBytes(): number { return this.tracks.reduce((sum, track) => sum + track.retainedBytes, 0); }
  get dirty(): boolean { return this.mixerDirty || this.persistence.dirty || this.tracks.some((track) => track.performing); }
  initializeStorage(): Promise<void> { return this.persistence.initialize(); }
  listenForStorageChanges(): () => void { return this.persistence.listen(); }
  invalidateProject(): void { this.persistence.markExternalChange(); }
  retryStorage(): Promise<void> { return this.snapshot.performing ? Promise.resolve() : this.persistence.retry(); }
  useSessionOnly(): void { if (!this.snapshot.performing) this.persistence.useSessionOnly(); }
  failProjectInitialization(error: unknown): void { this.persistence.failInitialization(error); }
  get projectChanging(): boolean { return this.persistence.replacing; }
  get projectChangeReason(): string | null {
    if (this.projectChanging) return "프로젝트를 전환하고 있습니다.";
    if (this.snapshot.performing) return "녹음·오버더빙·편집이 끝난 뒤 프로젝트를 전환하세요.";
    if (this.dirty || this.snapshot.mixerPending) return "현재 변경을 저장한 뒤 프로젝트를 전환하세요.";
    if (!["saved", "empty"].includes(this.snapshot.save.phase)) return "저장 상태를 확인하고 오류를 해결한 뒤 프로젝트를 전환하세요.";
    return null;
  }
  beginProjectChange(initial = false): boolean {
    if ((!initial && this.projectChangeReason) || this.dirty || this.snapshot.mixerPending) return false;
    return this.persistence.beginReplacement(initial);
  }
  cancelProjectChange(): void { this.persistence.cancelReplacement(); }
  adoptProject(repository: SessionRepository<StationProject>, saved: StoredSession<StationProject> | null): void {
    if (this.node || this.context) throw new Error("오디오를 종료한 뒤 프로젝트를 전환하세요.");
    this.input.release();
    this.persistence.adopt(repository, saved, { tracks: emptyStationHistory(), mixer: defaultStationMix(), master: defaultMasterMix() });
  }
  configureProject(config: TransportConfig): void {
    if (this.locked || !isTransportConfig(config)) return;
    if (this.projectTransport.bpm === config.bpm && this.projectTransport.numerator === config.numerator && this.projectTransport.denominator === config.denominator) return;
    this.projectTransport = { bpm: config.bpm, numerator: config.numerator, denominator: config.denominator };
    this.persistProject();
    this.refresh();
  }
  attach(context: AudioContext, node: AudioWorkletNode): void {
    this.context = context;
    this.node = node;
    this.resetOutputMeters();
    this.sendMixer();
    if (this.snapshot.config) node.port.postMessage({ type: "transport-configure", config: this.snapshot.config });
    this.tracks.forEach((track) => track.attach(context, node));
  }
  detach(): void {
    this.context = null;
    this.node = null;
    this.meters.set(null);
    this.mixerAppliedSequence = this.mixerSequence;
    this.tracks.forEach((track) => track.detach());
    this.commitMixer();
  }
  setRunning(running: boolean): void {
    this.resetOutputMeters();
    this.tracks.forEach((track) => track.setRunning(running));
  }
  stop(): void { this.tracks.forEach((track) => track.stop()); }
  acceptTransport(transport: TransportSnapshot): void { this.tracks.forEach((track) => track.acceptTransport(transport)); }
  accept(value: unknown): void {
    if (isOutputMeterSnapshot(value)) {
      if (this.node && this.context?.state === "running" && value.sequence === this.mixerSequence && value.revision === this.meterRevision) {
        this.meters.set(value);
      }
      return;
    }
    if (this.node && typeof value === "object" && value !== null && "type" in value
      && value.type === "station-mixer-applied" && "sequence" in value && value.sequence === this.mixerSequence) {
      this.mixerAppliedSequence = this.mixerSequence;
      this.refresh();
      return;
    }
    if (typeof value !== "object" || value === null || !("trackId" in value) || !isTrackId(value.trackId)) return;
    this.tracks[value.trackId].accept(value);
  }

  setTrackMix(trackId: number, patch: Partial<TrackMix>): void {
    if (!isTrackId(trackId) || this.persistence.snapshot.editLocked || this.snapshot.performing) return;
    const previous = this.mixer[trackId];
    const next = { ...previous, ...patch };
    if (!isTrackMix(next) || (next.gainDb === previous.gainDb && next.mute === previous.mute && next.solo === previous.solo && next.pan === previous.pan)) return;
    this.mixer = this.mixer.map((track, index) => index === trackId ? next : track);
    this.mixerChanged();
  }

  setMasterMix(patch: Partial<MasterMix>): void {
    if (this.persistence.snapshot.editLocked || this.snapshot.performing) return;
    const next = { ...this.master, ...patch };
    if (!isMasterMix(next) || (next.gainDb === this.master.gainDb && next.mute === this.master.mute)) return;
    this.master = next;
    this.mixerChanged();
  }
  resetOutputMeters(): void {
    this.meters.set(null);
    this.meterRevision += 1;
    this.node?.port.postMessage({ type: "station-meter-reset", revision: this.meterRevision });
  }
  private mixerChanged(): void {
    this.mixerDirty = true;
    this.mixerCommitRequested = false;
    this.sendMixer();
    this.refresh();
  }

  /** Save at gesture end, not on every slider sample (which would copy PCM). */
  commitMixer(): void {
    if (!this.mixerDirty) return;
    this.mixerCommitRequested = true;
    this.saveMixerIfReady();
  }
  private sendMixer(): void {
    this.mixerSequence += 1;
    if (this.node) this.node.port.postMessage({ type: "station-mixer", sequence: this.mixerSequence, mix: this.mixer, master: this.master });
    else this.mixerAppliedSequence = this.mixerSequence;
  }
  private saveMixerIfReady(): void {
    if (!this.mixerDirty || !this.mixerCommitRequested || this.mixerAppliedSequence !== this.mixerSequence
      || this.persistence.snapshot.editLocked || this.tracks.some((track) => track.performing)) return;
    this.persistProject();
    this.refresh();
  }
  private persistProject(): void {
    this.mixerDirty = false;
    this.mixerCommitRequested = false;
    this.persistence.changed({ tracks: this.tracks.map((track) => track.historyState), mixer: this.mixer, master: this.master, transport: this.projectTransport });
  }

  private refresh(): void {
    if (this.hydrating) return;
    const active = this.tracks.findIndex((track) => track.performing);
    const activeTrack = active < 0 ? null : active;
    const save = this.persistence.snapshot;
    const changed = activeTrack !== this.activeTrack || save !== this.snapshot.save;
    this.activeTrack = activeTrack;
    this.input.setCaptureLocked(this.projectChanging || this.tracks.some((track) => isCapturePhase(track.getSnapshot().phase)));
    if (changed) this.tracks.forEach((track) => track.refreshWorkspace());
    const clipCount = this.tracks.filter((track) => track.getSnapshot().hasClip).length;
    // Keep tempo fixed while a cleared take can still be restored.
    const retainedConfig = this.tracks.map((track) => track.historyState).flatMap((history) => [history.current, history.cleared?.current])
      .find((take) => take)?.metadata ?? null;
    const config = this.projectTransport;
    const locked = retainedConfig !== null || activeTrack !== null || save.editLocked;
    const mixerPending = this.node !== null && this.mixerAppliedSequence !== this.mixerSequence;
    if (save === this.snapshot.save && (activeTrack !== null) === this.snapshot.performing
      && clipCount === this.snapshot.clipCount && config === this.snapshot.config && locked === this.snapshot.locked
      && this.mixer === this.snapshot.mixer && this.master === this.snapshot.master && mixerPending === this.snapshot.mixerPending
      && this.mixerDirty === this.snapshot.mixerDirty) return;
    this.snapshot = { save, performing: activeTrack !== null, locked, config, clipCount,
      mixer: this.mixer, master: this.master, mixerPending, mixerDirty: this.mixerDirty };
    for (const listener of this.listeners) listener();
    this.saveMixerIfReady();
  }
}
