import { describe, expect, it, vi } from "vitest";
import { OutputVolume } from "../../src/audio/engine/output-volume";

function fixture() {
  const gain = () => ({ gain: { value: 0, setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
  const compressor = { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const gains: ReturnType<typeof gain>[] = [];
  const context = { currentTime: 2, destination: {}, createGain: () => { const node = gain(); gains.push(node); return node; }, createDynamicsCompressor: () => compressor };
  return { context, gains, compressor };
}

describe("final listening volume", () => {
  it("routes stereo listening gain through compression and an independent mute stage", () => {
    const f = fixture(); const output = new OutputVolume(f.context as unknown as AudioContext, 200, false);
    expect(output.input.channelCount).toBe(2);
    expect(f.gains[0].gain.value).toBe(2);
    expect(f.gains[0].connect).toHaveBeenCalledWith(f.compressor);
    expect(f.compressor.connect).toHaveBeenCalledWith(f.gains[1]);
    expect(f.gains[1].connect).toHaveBeenCalledWith(f.context.destination);
    output.setVolume(400); expect(f.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(4, 2, 0.01);
    output.setMuted(true); expect(f.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.005);
    output.setMuted(false); expect(f.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2, 0.005);
    output.dispose(); expect(f.gains.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
    expect(f.compressor.disconnect).toHaveBeenCalledOnce();
  });
  it("rejects invalid gain requests and supports silence without losing the mute switch", () => {
    const f = fixture(); const output = new OutputVolume(f.context as unknown as AudioContext, 300, true);
    for (const value of [-1, 401, Number.NaN, Infinity]) output.setVolume(value);
    expect(f.gains[0].gain.setTargetAtTime).not.toHaveBeenCalled();
    expect(f.gains[1].gain.value).toBe(0);
    output.setVolume(0); expect(f.gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.01);
    expect(f.gains[1].gain.setTargetAtTime).not.toHaveBeenCalled(); output.dispose();
  });
});
