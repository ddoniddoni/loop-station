import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import { EnvironmentDiagnostics } from "@/components/audio/environment-diagnostics";
import { MicrophoneSetup } from "@/components/audio/microphone-setup";
import { StudioNavigation } from "@/components/studio/studio-navigation";
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
  { number: "08", name: "빈 트랙", tone: "muted" },
] as const;

type TrackSlot = (typeof trackSlots)[number];

function LibraryPanel() {
  return (
    <aside id="library" tabIndex={-1} className="station-library" aria-labelledby="library-title">
      <div className="station-library-head">
        <Heading as="h2" id="library-title" size="4"><StudioIcon name="folder" />{ko.studioLibraryTitle}</Heading>
        <Text as="p" size="2" color="gray">{ko.studioLibrarySubtitle}</Text>
      </div>
      <div className="station-library-empty">
        <span className="station-empty-folder"><StudioIcon name="folder" size={28} /></span>
        <Text as="p" size="3" weight="medium">{ko.studioLibraryEmpty}</Text>
        <Text as="p" size="2" color="gray">{ko.studioLibraryHint}</Text>
      </div>
      <div className="station-library-foot">
        <Button type="button" variant="soft" color="gray" disabled aria-describedby="availability"><StudioIcon name="upload" />{ko.studioImportUnavailable}</Button>
        <a href="#settings"><StudioIcon name="settings" size={18} />{ko.studioLibrarySettings}<StudioIcon name="chevron" size={16} /></a>
      </div>
    </aside>
  );
}

function TrackCard({ slot }: { slot: TrackSlot }) {
  return (
    <Card size="2" asChild>
      <article className="station-track-card" data-tone={slot.tone} data-track={slot.number} aria-label={`${slot.number} ${slot.name}: ${ko.studioTrackIdle}`}>
        <div className="station-track-header">
          <div className="station-track-title">
            <span className="station-track-number">{slot.number}</span>
            <Heading as="h3" size="4">{slot.name}</Heading>
          </div>
          <Badge color="gray" variant="outline" size="1">{ko.studioTrackIdle}</Badge>
        </div>
        <div className="station-track-window">
          <div className="station-track-ruler" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span></div>
          <div className="station-track-placeholder">
            <StudioIcon name="loop" size={24} />
            <Text as="p" size="2">{ko.studioTrackEmpty}</Text>
          </div>
        </div>
        <div className="station-track-tools" aria-label={ko.studioTrackTools}>
          <Button type="button" variant="soft" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} ${ko.studioMute}`}>{ko.studioMute}</Button>
          <Button type="button" variant="soft" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} ${ko.studioSolo}`}>{ko.studioSolo}</Button>
          <Button type="button" variant="soft" color="gray" disabled aria-describedby="availability" aria-label={`${slot.number} ${ko.studioUndo}`} title={ko.studioUndo}><StudioIcon name="undo" size={18} /></Button>
        </div>
        <Button type="button" variant="outline" disabled aria-describedby="availability" className="station-track-action">
          <StudioIcon name="plus" size={18} />{ko.studioRecordUnavailable}
        </Button>
      </article>
    </Card>
  );
}

function TrackBoard() {
  return (
    <section id="tracks" tabIndex={-1} className="station-track-board" aria-labelledby="tracks-title">
      <div className="station-board-heading">
        <div>
          <Heading as="h2" id="tracks-title" size="5">{ko.studioTracksTitle}</Heading>
          <Text as="p" size="2" color="gray">{ko.studioTracksHint}</Text>
        </div>
        <Badge color="gray" variant="soft">8 {ko.studioTrackNav}</Badge>
      </div>
      <div className="station-track-grid">{trackSlots.map((slot) => <TrackCard key={slot.number} slot={slot} />)}</div>
    </section>
  );
}

function InspectorPanel() {
  return (
    <aside id="settings" tabIndex={-1} className="station-inspector" aria-labelledby="inspector-title">
      <div className="station-inspector-head">
        <Heading as="h2" id="inspector-title" size="4"><StudioIcon name="settings" />{ko.studioSetupTitle}</Heading>
        <Text as="p" size="2" color="gray">{ko.studioSettingsHint}</Text>
      </div>
      <section className="station-inspector-section" aria-labelledby="clip-settings-title">
        <Heading as="h3" id="clip-settings-title" size="2">{ko.studioClipTitle}</Heading>
        <div className="station-inspector-empty">
          <StudioIcon name="loop" size={18} />
          <Text as="p" size="2">{ko.studioNoClip}</Text>
        </div>
      </section>
      <div className="station-inspector-section station-input-panel"><MicrophoneSetup /></div>
      <section className="station-inspector-section" aria-labelledby="fx-title">
        <Heading as="h3" id="fx-title" size="2">{ko.studioFxTitle}</Heading>
        <div className="station-inspector-empty station-fx-empty">
          <Text as="p" size="2">{ko.studioFxUnavailable}</Text>
        </div>
      </section>
      <details className="station-inspector-section station-diagnostics">
        <summary><span>{ko.diagnosticsTitle}</span><StudioIcon name="chevron" size={18} /></summary>
        <EnvironmentDiagnostics />
      </details>
      <section className="station-inspector-section station-project" aria-labelledby="project-title">
        <Heading as="h3" id="project-title" size="2">{ko.studioProjectTitle}</Heading>
        <Text as="p" size="2" color="gray">{ko.studioProjectDescription}</Text>
        <div className="station-project-actions">
          <Button type="button" variant="soft" disabled aria-describedby="availability">{ko.newProject}</Button>
          <Button type="button" variant="outline" disabled aria-describedby="availability">{ko.demo}</Button>
        </div>
      </section>
    </aside>
  );
}

function MixerConsole() {
  return (
    <section id="mixer" tabIndex={-1} className="station-mixer" aria-labelledby="mixer-title">
      <div className="station-mixer-heading">
        <Heading as="h2" id="mixer-title" size="4"><StudioIcon name="mixer" />{ko.studioMixerTitle}</Heading>
        <Badge color="gray" variant="soft">{ko.studioMixerUnavailable}</Badge>
      </div>
      <div className="station-mixer-channels">
        {trackSlots.map((slot) => (
          <div className="station-mixer-channel" data-tone={slot.tone} key={slot.number}>
            <div className="station-mixer-channel-head"><span>{slot.number} {slot.name}</span><span>—</span></div>
            <div className="station-mixer-fader" aria-hidden="true"><span /></div>
            <div className="station-mixer-channel-foot"><span>{ko.studioNotConnected}</span></div>
          </div>
        ))}
        <div className="station-mixer-channel station-mixer-master">
          <div className="station-mixer-channel-head"><span>{ko.studioMaster}</span><span>—</span></div>
          <div className="station-mixer-fader" aria-hidden="true"><span /></div>
          <div className="station-mixer-channel-foot"><span>{ko.studioMixerUnavailable}</span></div>
        </div>
      </div>
    </section>
  );
}

export function StudioWorkspace() {
  return (
    <>
      <div className="station-workspace">
        <LibraryPanel />
        <TrackBoard />
        <InspectorPanel />
      </div>
      <MixerConsole />
      <StudioNavigation placement="mobile" />
    </>
  );
}
