"use client";

import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import { EnvironmentDiagnostics } from "@/components/audio/environment-diagnostics";
import { StudioInputPanel } from "@/components/studio/studio-input-panel";
import { StudioMobileNavigation, type StudioView } from "@/components/studio/studio-navigation";
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
  { number: "08", name: "Empty Track", tone: "muted" },
] as const;
type TrackSlot = (typeof trackSlots)[number];

function LibraryPanel() {
  return (
    <aside id="library" tabIndex={-1} className="station-library" aria-labelledby="library-title">
      <div className="station-library-head">
        <Heading as="h2" id="library-title" size="4"><StudioIcon name="folder" />Library Browser</Heading>
        <Text as="p" size="2" color="gray">내 사운드 라이브러리</Text>
      </div>
      <div className="station-library-tabs" aria-label="라이브러리 유형"><span className="is-current">Loops</span><span>Samples</span><span>Presets</span><span>Files</span></div>
      <div className="station-library-content">
        <div className="station-library-row"><StudioIcon name="folder" size={16} /><span>My Loops</span><small>0</small></div>
        <div className="station-library-row"><StudioIcon name="folder" size={16} /><span>Imported Samples</span><small>0</small></div>
        <div className="station-library-empty"><StudioIcon name="upload" size={24} /><Text as="p" size="2">{ko.studioLibraryEmpty}</Text><Text as="p" size="1" color="gray">샘플 가져오기 준비 중</Text></div>
      </div>
      <div className="station-library-foot"><Button type="button" variant="outline" color="gray" disabled aria-describedby="availability"><StudioIcon name="upload" size={16} />Import Sample</Button><Text as="p" size="1" color="gray">로컬 라이브러리 · 준비 중</Text></div>
    </aside>
  );
}

function TrackCard({ slot, selected, onSelect }: { slot: TrackSlot; selected: boolean; onSelect: () => void }) {
  const emptySlot = slot.number === "08";
  return (
    <Card size="1" asChild>
      <article className="station-track-card" data-tone={slot.tone} data-track={slot.number} data-selected={selected} data-bank={Number(slot.number) <= 4 ? 0 : 1} aria-label={`${slot.number} ${slot.name}: ${ko.studioTrackIdle}`}>
        <div className="station-track-header">
          <Heading as="h3" size="3"><button type="button" className="station-track-select" aria-pressed={selected} aria-label={`${slot.number} ${slot.name} 트랙 선택`} onClick={onSelect}><i aria-hidden="true" /><span><b>{slot.number}</b> {slot.name}</span></button></Heading>
          <span className="station-track-state">EMPTY</span>
        </div>
        <div className="station-track-window" aria-label="녹음된 오디오 없음"><StudioIcon name={emptySlot ? "plus" : "loop"} size={emptySlot ? 28 : 18} /><Text as="p" size="1">{emptySlot ? "새 루프를 위한 빈 트랙" : "녹음된 루프 없음"}</Text></div>
        <div className="station-track-tools" aria-label={ko.studioTrackTools}>
          <Button type="button" variant="outline" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} ${ko.studioMute}`}><span className="station-tool-short">M</span><span className="station-tool-long">MUTE</span></Button>
          <Button type="button" variant="outline" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} ${ko.studioSolo}`}><span className="station-tool-short">S</span><span className="station-tool-long">SOLO</span></Button>
          <Button type="button" variant="outline" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} ${ko.studioUndo}`}><StudioIcon name="undo" size={14} /><span className="station-tool-long">UNDO</span></Button>
          <span className="station-track-vol" aria-hidden="true">VOL <i /></span>
          <Button type="button" className="station-track-stop" variant="outline" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} 트랙 정지`}><StudioIcon name="stop" size={13} /><span className="station-tool-long">STOP</span></Button>
        </div>
        <Button type="button" variant="outline" disabled aria-describedby="availability" className="station-track-action"><span className="station-record-dot" aria-hidden="true" /><span>[ RECORD NEW LOOP ]<small>녹음 준비 중</small></span></Button>
      </article>
    </Card>
  );
}

function TrackBoard({ selected, onSelect, bank, onBankChange }: { selected: TrackSlot; onSelect: (slot: TrackSlot) => void; bank: number; onBankChange: (bank: number) => void }) {
  return (
    <section id="tracks" tabIndex={-1} className="station-track-board" data-bank={bank} aria-labelledby="tracks-title">
      <Heading as="h2" id="tracks-title" className="sr-only">{ko.studioTracksTitle}</Heading>
      <div className="station-bank-switch"><Button variant="outline" color="gray" aria-pressed={bank === 0} onClick={() => onBankChange(0)}>Bank 1–4</Button><Button variant="outline" color="gray" aria-pressed={bank === 1} onClick={() => onBankChange(1)}>Bank 5–8</Button><span>8 TRACKS</span></div>
      <div className="station-track-grid">{trackSlots.map((slot) => <TrackCard key={slot.number} slot={slot} selected={selected === slot} onSelect={() => onSelect(slot)} />)}</div>
    </section>
  );
}

function InspectorPanel({ selected }: { selected: TrackSlot }) {
  return (
    <aside id="settings" tabIndex={-1} className="station-inspector" aria-labelledby="inspector-title" data-tone={selected.tone}>
      <div className="station-inspector-head"><Text as="p" className="station-overline">FOCUSED TRACK</Text><Heading as="h2" id="inspector-title" size="4">Track {selected.number} – {selected.name}</Heading><Badge variant="outline" color="gray">비어 있음</Badge></div>
      <section className="station-inspector-section station-clip-settings" aria-labelledby="clip-settings-title">
        <Heading as="h3" id="clip-settings-title" size="2">CLIP SETTINGS</Heading>
        <div className="station-clip-fields"><div><span>LOOP MODE</span><strong>—</strong></div><div><span>LENGTH</span><strong>—</strong></div></div>
        <div className="station-speed-controls">{["REV", "0.5x", "1x", "2x"].map((label) => <Button key={label} variant="outline" color="gray" disabled aria-describedby="availability">{label}</Button>)}</div>
        <Text as="p" size="1" color="gray" mt="2">{ko.studioNoClip}</Text>
      </section>
      <StudioInputPanel />
      <section id="fx" tabIndex={-1} className="station-inspector-section station-fx" aria-labelledby="fx-title">
        <div className="station-section-heading"><Heading as="h3" id="fx-title" size="2">INSERT FX CHAIN</Heading><Button variant="ghost" color="gray" disabled aria-describedby="availability">+ ADD FX</Button></div>
        <div className="station-fx-slot"><StudioIcon name="wave" /><div><Text as="p" size="2">이펙트 없음</Text><Text as="p" size="1" color="gray">{ko.studioFxUnavailable}</Text></div></div>
      </section>
      <details className="station-inspector-section station-diagnostics"><summary>{ko.diagnosticsTitle}<StudioIcon name="chevron" size={14} /></summary><EnvironmentDiagnostics /></details>
      <section id="project" tabIndex={-1} className="station-inspector-section station-project" aria-labelledby="project-title"><Heading as="h3" id="project-title" size="2">PROJECT</Heading><Text as="p" size="1" color="gray">{ko.studioProjectDescription}</Text><div className="station-project-actions"><Button variant="outline" color="gray" disabled aria-describedby="availability">{ko.newProject}</Button><Button variant="outline" color="gray" disabled aria-describedby="availability">{ko.demo}</Button></div></section>
    </aside>
  );
}

function MixerConsole({ bank }: { bank: number }) {
  return (
    <section id="mixer" tabIndex={-1} className="station-mixer" data-bank={bank} aria-labelledby="mixer-title">
      <div className="station-mixer-heading"><Heading as="h2" id="mixer-title" size="2"><StudioIcon name="mixer" size={16} />MIXER CONSOLE <span>| 8 Tracks + Master Stereo Bus</span></Heading><Text as="span" size="1" color="gray">믹서 준비 중</Text></div>
      <div className="station-mixer-channels">
        {trackSlots.map((slot) => <div className="station-mixer-channel" data-tone={slot.tone} data-bank={Number(slot.number) <= 4 ? 0 : 1} key={slot.number}><div className="station-mixer-channel-head"><span>{slot.number} {slot.name}</span><span>—</span></div><div className="station-mixer-pan" aria-hidden="true">PAN <i /> C</div><div className="station-mixer-fader" aria-hidden="true"><span /><i /></div><div className="station-mixer-channel-foot"><span>M</span><span>S</span><span className="station-record-dot" /></div></div>)}
        <div className="station-mixer-channel station-mixer-master"><div className="station-mixer-channel-head"><span>MASTER BUS</span><span>— dB</span></div><div className="station-mixer-pan">미연결</div><div className="station-mixer-fader" aria-hidden="true"><span /><i /></div><Button variant="outline" color="gray" disabled aria-describedby="availability">BUS MUTE</Button></div>
      </div>
    </section>
  );
}

export function StudioWorkspace() {
  const [selected, setSelected] = useState<TrackSlot>(trackSlots[2]);
  const [bank, setBank] = useState(0);
  const [view, setView] = useState<StudioView>("tracks");
  return (
    <div className="station-studio" data-view={view}>
      <div className="station-workspace"><LibraryPanel /><TrackBoard selected={selected} onSelect={setSelected} bank={bank} onBankChange={setBank} /><InspectorPanel selected={selected} /></div>
      <MixerConsole bank={bank} />
      <StudioMobileNavigation view={view} onNavigate={setView} />
    </div>
  );
}
