/** Musical positions use quarter-note ticks. No browser or React dependency. */
export const PPQ = 960;

export type TempoAnchor = Readonly<{
  bpm: number;
  sampleRate: number;
  startTick: number;
  startFrame: number;
}>;

function requireSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function validateAnchor(anchor: TempoAnchor): void {
  if (!Number.isFinite(anchor.bpm) || anchor.bpm <= 0) {
    throw new RangeError("bpm must be finite and positive");
  }
  requireSafeInteger(anchor.sampleRate, "sampleRate");
  if (anchor.sampleRate <= 0) throw new RangeError("sampleRate must be positive");
  requireSafeInteger(anchor.startTick, "startTick");
  requireSafeInteger(anchor.startFrame, "startFrame");
}

/** Derive each boundary from the absolute tick; never add rounded loop lengths. */
export function frameAtTick(tick: number, anchor: TempoAnchor): number {
  validateAnchor(anchor);
  requireSafeInteger(tick, "tick");
  const offsetTicks = tick - anchor.startTick;
  requireSafeInteger(offsetTicks, "tick offset");
  const frame = anchor.startFrame + Math.round(
    (offsetTicks / PPQ) * (60 / anchor.bpm) * anchor.sampleRate,
  );
  requireSafeInteger(frame, "resolved frame");
  return frame;
}

/** BPM remains quarter-note based, including compound meters such as 6/8. */
export function ticksPerBar(numerator: number, denominator: number): number {
  requireSafeInteger(numerator, "numerator");
  requireSafeInteger(denominator, "denominator");
  if (numerator <= 0 || denominator <= 0 || !Number.isInteger(Math.log2(denominator))) {
    throw new RangeError("time signature must use positive beats and a power-of-two denominator");
  }
  const ticks = numerator * (4 / denominator) * PPQ;
  requireSafeInteger(ticks, "bar ticks");
  if (ticks <= 0) throw new RangeError("bar must contain at least one tick");
  return ticks;
}
