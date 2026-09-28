import guitar from "../../../public/audio/guitar/freepats-20190618/provenance.json";
import { pianoBank, PIANO_ASSET_PATH, PIANO_RELEASE, type PianoOctave } from "./piano-bank";

export type MelodicInstrument = "piano" | "guitar";
export type SampleRegion = { file: string; sha256: string; bytes: number; channels: number; sampleRate: number; frames: number; low: number; high: number; root: number; loopStart: number | null; loopEnd: number | null };
// One selected bank: octave banks stay <32MiB at 192kHz; chords decode at 44.1kHz.
export const MELODIC_MEMORY_BYTES = 64 * 1024 * 1024;
export const MELODIC_INSTRUMENTS = {
  piano: { label: "피아노", octaves: [3, 4, 5], defaultOctave: 4, offset: 0, release: PIANO_RELEASE, sustain: true,
    assetPath: PIANO_ASSET_PATH, credit: "Upright Piano KW · Gonzalo & Roberto · CC0" },
  guitar: { label: "기타", octaves: [2, 3, 4], defaultOctave: 3, offset: 4, release: 1.5, sustain: false,
    assetPath: "/audio/guitar/freepats-20190618/", credit: "Spanish Classical Guitar · Roberto · CC0" },
} as const;
export function melodicBase(instrument: MelodicInstrument, octave: number): number {
  return (octave + 1) * 12 + MELODIC_INSTRUMENTS[instrument].offset;
}
export function melodicBank(instrument: MelodicInstrument, octave: number): readonly SampleRegion[] {
  if (instrument === "piano") return pianoBank(octave as PianoOctave);
  const low = melodicBase(instrument, octave);
  return guitar.samples.filter((sample) => sample.low <= low + 12 && sample.high >= low);
}
