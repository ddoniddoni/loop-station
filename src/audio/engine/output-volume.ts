export const DEFAULT_OUTPUT_VOLUME = 200;
export const MAX_OUTPUT_VOLUME = 400;

export function isOutputVolume(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_OUTPUT_VOLUME;
}

/** Final listening gain; never connected back to the recorder. */
export class OutputVolume {
  readonly input: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly muteGain: GainNode;

  constructor(private readonly context: AudioContext, volume: number, muted: boolean) {
    this.input = context.createGain();
    this.input.channelCount = 2;
    this.input.channelCountMode = "explicit";
    this.input.gain.value = (isOutputVolume(volume) ? volume : DEFAULT_OUTPUT_VOLUME) / 100;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -3;
    this.compressor.knee.value = 3;
    this.compressor.ratio.value = 20;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;
    this.muteGain = context.createGain();
    this.muteGain.gain.value = muted ? 0 : 1;
    this.input.connect(this.compressor);
    this.compressor.connect(this.muteGain);
    this.muteGain.connect(context.destination);
  }
  setVolume(volume: number): void {
    if (!isOutputVolume(volume)) return;
    this.input.gain.setTargetAtTime(volume / 100, this.context.currentTime, 0.01);
  }
  setMuted(muted: boolean): void {
    this.muteGain.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.005);
  }
  dispose(): void { this.input.disconnect(); this.compressor.disconnect(); this.muteGain.disconnect(); }
}
