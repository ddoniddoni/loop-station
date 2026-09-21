function ramp(param: AudioParam, value: number, time: number): void {
  const current = param.value;
  param.cancelScheduledValues(time);
  param.setValueAtTime(current, time);
  param.linearRampToValueAtTime(value, time + 0.01);
}

// One mono input bus and one monitor path, shared with the transport's context.
export class MicrophoneInputBus {
  private source: MediaStreamAudioSourceNode | null = null;
  private readonly inputGain: GainNode;
  private readonly monitorGain: GainNode;

  constructor(private readonly context: AudioContext, private readonly node: AudioWorkletNode) {
    this.inputGain = context.createGain();
    this.inputGain.channelCount = 1;
    this.inputGain.channelCountMode = "explicit";
    this.inputGain.channelInterpretation = "speakers";
    this.monitorGain = context.createGain();
    this.monitorGain.gain.value = 0;
    this.inputGain.connect(node);
    node.connect(this.monitorGain, 2);
    this.monitorGain.connect(context.destination);
  }

  connect(stream: MediaStream): void {
    const source = this.context.createMediaStreamSource(stream);
    try {
      source.connect(this.inputGain);
    } catch (error) {
      source.disconnect();
      throw error;
    }
    this.disconnectInput();
    this.source = source;
  }

  disconnectInput(): void {
    this.setMonitor(0, true);
    this.source?.disconnect();
    this.source = null;
  }

  setGain(db: number): void {
    ramp(this.inputGain.gain, 10 ** (db / 20), this.context.currentTime);
  }

  setMonitor(level: number, immediate = false): void {
    const param = this.monitorGain.gain;
    const time = this.context.currentTime;
    if (immediate) {
      param.cancelScheduledValues(time);
      param.setValueAtTime(level, time);
    } else {
      ramp(param, level, time);
    }
  }

  dispose(): void {
    this.disconnectInput();
    this.inputGain.disconnect();
    this.node.disconnect(this.monitorGain, 2);
    this.monitorGain.disconnect();
  }
}
