import { describe, expect, it } from "vitest";
import { OutputLevelMeter } from "../../src/audio/loop/output-meter";

describe("PCM peak, stereo RMS and hold", () => {
  it("measures signed channels and preserves only hold/overload across windows", () => {
    const meter = new OutputLevelMeter();
    meter.add(-0.5, 0.25);
    meter.add(0, 0);
    const first = meter.snapshot();
    expect(first.peak).toBe(0.5);
    expect(first.rms).toBeCloseTo(Math.sqrt((0.25 + 0.0625) / 4), 10);
    expect(first.hold).toBe(0.5);
    meter.add(0, 0);
    expect(meter.snapshot()).toEqual({ peak: 0, rms: 0, hold: 0.5, clipped: false });
    meter.add(1, 1, true);
    meter.snapshot();
    expect(meter.snapshot().clipped).toBe(true);
    meter.reset();
    expect(meter.snapshot()).toEqual({ peak: 0, rms: 0, hold: 0, clipped: false });
  });
});
