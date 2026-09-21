/** Small mono click voice for the Worklet's separate click output. */
export class ClickVoice {
  private phase = 0;
  private phaseStep = 0;
  private level = 0;
  private readonly decay: number;
  private readonly stopDecay: number;

  constructor(private readonly sampleRate: number) {
    this.decay = Math.exp(Math.log(0.001) / (sampleRate * 0.025));
    this.stopDecay = Math.exp(Math.log(0.001) / (sampleRate * 0.002));
  }

  trigger(accent: boolean): void {
    this.phase = 0;
    this.phaseStep = 2 * Math.PI * (accent ? 1500 : 950) / this.sampleRate;
    this.level = accent ? 0.48 : 0.3;
  }

  nextSample(active: boolean): number {
    if (this.level < 0.0001) return 0;
    const value = Math.sin(this.phase) * this.level;
    this.phase += this.phaseStep;
    if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;
    this.level *= active ? this.decay : this.stopDecay;
    return value;
  }
}
