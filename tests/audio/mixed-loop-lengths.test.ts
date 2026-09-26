import { expect, it } from "vitest";
import { PcmStation } from "../../src/audio/loop/pcm-station";
import { RECORD_LENGTHS, recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { AudioFrameClock } from "../../src/audio/transport/audio-frame-clock";
import { ticksPerBar } from "../../src/audio/transport/timing";

it("keeps 1/2/4/8-bar PCM on absolute boundaries through ten minutes of fractional 7/8 timing", () => {
  // 8kHz keeps this DSP-only simulation bounded; it is not a physical device test.
  const rate = 8000;
  const config = { bpm: 127, numerator: 7, denominator: 8 };
  const barTicks = ticksPerBar(7, 8);
  const clock = new AudioFrameClock(rate);
  clock.configure(config);
  const station = new PcmStation(clock, rate, { postMessage() {} });
  RECORD_LENGTHS.forEach((bars, trackId) => {
    const pcm = new Float32Array(recordingCapacity(rate, config, bars));
    pcm[0] = 0.125;
    station.handle({ type: "loop-restore", trackId, sequence: 1, pcm: pcm.buffer,
      metadata: { ...config, sampleRate: rate, ticks: barTicks * bars,
        frames: clock.frameAtTick(barTicks * bars), complete: true } }, 192, true);
  });
  station.play(192);
  const blocks = [64, 192, 127, 256];
  let block = 0;
  function render(until: number) {
    while (clock.positionFrame < until) {
      const start = clock.positionFrame;
      const count = Math.min(blocks[block++ % blocks.length], until - start);
      for (let offset = 0; offset < count; offset += 1) station.nextSample(0, start + offset);
      clock.advance(count);
      station.publish(false);
    }
  }
  for (let bar = 1; clock.positionFrame < rate * 600; bar += 1) {
    const boundary = clock.frameAtTick(bar * barTicks);
    render(boundary);
    if (bar === 1) expect(station.left).toBe(0);
    render(boundary + 1);
    const expected = RECORD_LENGTHS.filter((bars) => (bar - 1) % bars === 0).length * 0.125 * 0.5;
    expect(station.left).toBe(expected);
    expect(station.right).toBe(expected);
  }
}, 30_000);
