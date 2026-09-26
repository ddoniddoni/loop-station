export type InputChannel = "mono" | "left" | "right";

// Do not infer stereo support from a device label or a requested constraint.
export function isInputChannelAvailable(channel: unknown, channelCount?: number): channel is InputChannel {
  if (channel === "mono") return true;
  if (!Number.isSafeInteger(channelCount) || channelCount === undefined || channelCount < 1) return false;
  return channel === "left" || (channel === "right" && channelCount >= 2);
}
