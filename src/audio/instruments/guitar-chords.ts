import guitar from "../../../public/audio/guitar/freepats-20190618/provenance.json";

// Standard tuning, low E to high E; null means a muted string.
const tuning = [40, 45, 50, 55, 59, 64];
export const GUITAR_CHORDS = [
  { id: "C", name: "C 메이저", frets: [null, 3, 2, 0, 1, 0] },
  { id: "D", name: "D 메이저", frets: [null, null, 0, 2, 3, 2] },
  { id: "E", name: "E 메이저", frets: [0, 2, 2, 1, 0, 0] },
  { id: "G", name: "G 메이저", frets: [3, 2, 0, 0, 0, 3] },
  { id: "Am", name: "A 마이너", frets: [null, 0, 2, 2, 1, 0] },
  { id: "Em", name: "E 마이너", frets: [0, 2, 2, 0, 0, 0] },
  { id: "F", name: "F 메이저", frets: [1, 3, 3, 2, 1, 1] },
  { id: "Dm", name: "D 마이너", frets: [null, null, 0, 2, 3, 1] },
] as const;
export type GuitarMode = "notes" | "chords";
export type GuitarChord = typeof GUITAR_CHORDS[number]["id"];
export type StrumDirection = "down" | "up";
export const STRUM_SPACING = { fast: 0.015, normal: 0.03, slow: 0.06 } as const;
export type StrumSpeed = keyof typeof STRUM_SPACING;
export const GUITAR_CHORD_SAMPLE_RATE = 44_100;

export function guitarChordNotes(id: GuitarChord): number[] {
  const chord = GUITAR_CHORDS.find((chord) => chord.id === id);
  return chord?.frets.flatMap((fret, index) => fret === null ? [] : [tuning[index] + fret]) ?? [];
}
const chordNotes = new Set(GUITAR_CHORDS.flatMap((chord) => guitarChordNotes(chord.id)));
// An explicit multi-octave bank, separate from the single-note octave limits.
export const GUITAR_CHORD_BANK = guitar.samples.filter((sample) => [...chordNotes].some((note) => sample.low <= note && note <= sample.high));
