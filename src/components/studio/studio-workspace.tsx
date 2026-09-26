"use client";

import { Badge, Button, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import { EnvironmentDiagnostics } from "@/components/audio/environment-diagnostics";
import { StudioInputPanel } from "@/components/studio/studio-input-panel";
import { MixerConsole } from "@/components/studio/mixer-console";
import { RecordedClipDetails, RecordingTrack } from "@/components/studio/recording-track";
import { StudioMobileNavigation } from "@/components/studio/studio-navigation";
import { useStudioView } from "./studio-view-provider";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

const trackSlots = [
  { number: "01", name: "Beat", tone: "mint" },
  { number: "02", name: "Bass", tone: "mint" },
  { number: "03", name: "Guitar", tone: "orange" },
  { number: "04", name: "Vocal", tone: "blue" },
  { number: "05", name: "Perc", tone: "mint" },
  { number: "06", name: "Harmony", tone: "muted" },
  { number: "07", name: "FX Loop", tone: "mint" },
  { number: "08", name: "Texture", tone: "muted" },
] as const;
type TrackSlot = (typeof trackSlots)[number];

function TrackBoard({ selected, onSelect, bank, onBankChange }: { selected: TrackSlot; onSelect: (slot: TrackSlot) => void; bank: number; onBankChange: (bank: number) => void }) {
  return (
    <section id="tracks" tabIndex={-1} className="station-track-board" data-bank={bank} aria-labelledby="tracks-title">
      <Heading as="h2" id="tracks-title" className="sr-only">{ko.studioTracksTitle}</Heading>
      <div className="station-bank-switch"><Button variant="outline" color="gray" aria-pressed={bank === 0} onClick={() => onBankChange(0)}>Bank 1–4</Button><Button variant="outline" color="gray" aria-pressed={bank === 1} onClick={() => onBankChange(1)}>Bank 5–8</Button><span>8 TRACKS</span></div>
      <div className="station-track-grid">{trackSlots.map((slot, trackId) =>
        <RecordingTrack key={slot.number} trackId={trackId} name={slot.name} tone={slot.tone} selected={selected === slot} onSelect={() => onSelect(slot)} />)}</div>
    </section>
  );
}

function InspectorPanel({ selected }: { selected: TrackSlot }) {
  return (
    <aside id="settings" tabIndex={-1} className="station-inspector" aria-labelledby="inspector-title" data-tone={selected.tone}>
      <div className="station-inspector-head"><Text as="p" className="station-overline">FOCUSED TRACK</Text><Heading as="h2" id="inspector-title" size="4">Track {selected.number} – {selected.name}</Heading><Badge variant="outline" color="gray">MONO</Badge></div>
      <section className="station-inspector-section station-clip-settings" aria-labelledby="clip-settings-title">
        <Heading as="h3" id="clip-settings-title" size="2">CLIP SETTINGS</Heading>
        <RecordedClipDetails trackId={Number(selected.number) - 1} />
        <div className="station-speed-controls">{["REV", "0.5x", "1x", "2x"].map((label) => <Button key={label} variant="outline" color="gray" disabled aria-describedby="availability">{label}</Button>)}</div>
      </section>
      <StudioInputPanel />
      <section id="fx" tabIndex={-1} className="station-inspector-section station-fx" aria-labelledby="fx-title">
        <div className="station-section-heading"><Heading as="h3" id="fx-title" size="2">INSERT FX CHAIN</Heading><Button variant="ghost" color="gray" disabled aria-describedby="availability">+ ADD FX</Button></div>
        <div className="station-fx-slot"><StudioIcon name="wave" /><div><Text as="p" size="2">이펙트 없음</Text><Text as="p" size="1" color="gray">{ko.studioFxUnavailable}</Text></div></div>
      </section>
      <details className="station-inspector-section station-diagnostics"><summary>{ko.diagnosticsTitle}<StudioIcon name="chevron" size={14} /></summary><EnvironmentDiagnostics /></details>
    </aside>
  );
}

export function StudioWorkspace() {
  const [selected, setSelected] = useState<TrackSlot>(trackSlots[0]);
  const [bank, setBank] = useState(0);
  const { view } = useStudioView();
  return (
    <div className="station-studio" data-view={view}>
      <div className="station-workspace"><TrackBoard selected={selected} onSelect={setSelected} bank={bank} onBankChange={setBank} /><InspectorPanel selected={selected} /></div>
      <MixerConsole bank={bank} onBankChange={setBank} slots={trackSlots} />
      <StudioMobileNavigation />
    </div>
  );
}
