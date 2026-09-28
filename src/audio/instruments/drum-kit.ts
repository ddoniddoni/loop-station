export const DRUM_MEMORY_BYTES = 8 * 1024 * 1024;
export const DRUM_KIT = [
  { id: "kick", label: "킥", key: "A", file: "Kick04.wav", gain: 1, hat: false },
  { id: "snare", label: "스네어", key: "S", file: "Snare09.wav", gain: 1, hat: false },
  { id: "closed-hat", label: "닫힌 하이햇", key: "D", file: "ClosedHiHat02-01.wav", gain: 1, hat: true },
  { id: "open-hat", label: "열린 하이햇", key: "F", file: "OpenHiHat02-01.wav", gain: 10 ** (-2 / 20), hat: true },
  { id: "clap", label: "클랩", key: "J", file: "Clap01.wav", gain: 1, hat: false },
  { id: "tom", label: "로우 탐", key: "K", file: "LowTom02-01.wav", gain: 1, hat: false },
  { id: "shaker", label: "셰이커", key: "L", file: "Shaker04.wav", gain: 10 ** (-7 / 20), hat: false },
  { id: "cymbal", label: "심벌", key: ";", file: "Cymbal02.wav", gain: 10 ** (-3 / 20), hat: false },
] as const;
export type DrumId = typeof DRUM_KIT[number]["id"];
export const DRUM_ASSET_PATH = "/audio/drums/freepats-20220718/";
