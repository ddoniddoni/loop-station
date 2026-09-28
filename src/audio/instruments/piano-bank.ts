import provenance from "../../../public/audio/piano/freepats-20190703/provenance.json";

export const PIANO_ASSET_PATH = "/audio/piano/freepats-20190703/";
export const PIANO_RELEASE = 0.6;
export type PianoOctave = 3 | 4 | 5;
export function pianoBank(octave: PianoOctave) {
  const low = (octave + 1) * 12;
  return provenance.samples.filter((sample) => sample.low <= low + 12 && sample.high >= low);
}
export const PIANO_KEYS = [
  { name: "도", note: "C", key: "A", code: "KeyA", white: 0 },
  { name: "도♯", note: "C♯", key: "W", code: "KeyW", white: null },
  { name: "레", note: "D", key: "S", code: "KeyS", white: 1 },
  { name: "레♯", note: "D♯", key: "E", code: "KeyE", white: null },
  { name: "미", note: "E", key: "D", code: "KeyD", white: 2 },
  { name: "파", note: "F", key: "F", code: "KeyF", white: 3 },
  { name: "파♯", note: "F♯", key: "T", code: "KeyT", white: null },
  { name: "솔", note: "G", key: "G", code: "KeyG", white: 4 },
  { name: "솔♯", note: "G♯", key: "Y", code: "KeyY", white: null },
  { name: "라", note: "A", key: "H", code: "KeyH", white: 5 },
  { name: "라♯", note: "A♯", key: "U", code: "KeyU", white: null },
  { name: "시", note: "B", key: "J", code: "KeyJ", white: 6 },
  { name: "도", note: "C", key: "K", code: "KeyK", white: 7 },
] as const;
