import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import { AudioSetup } from "@/components/audio/audio-setup";
import { EnvironmentDiagnostics } from "@/components/audio/environment-diagnostics";
import { MicrophoneSetup } from "@/components/audio/microphone-setup";
import { ko } from "@/lib/i18n/ko";

export default function Home() {
  return (
    <div className="studio-shell">
      <a className="skip-link" href="#main">{ko.skipToContent}</a>
      <header className="studio-topbar">
        <div className="studio-brand">
          <span className="studio-brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <Text as="span" weight="bold" className="studio-wordmark">LOOP/STATION</Text>
          <span className="studio-edition">WEB</span>
        </div>
        <div className="studio-header-status">
          <span className="studio-status-led" aria-hidden="true" />
          <Text as="span" size="1">{ko.studioLocal}</Text>
          <Badge color="jade" variant="soft" size="1">{ko.status}</Badge>
        </div>
      </header>

      <main id="main" className="studio-main">
        <div className="studio-heading">
          <Text as="p" size="1" className="studio-overline">{ko.studioOverline}</Text>
          <Heading as="h1" id="welcome-title" size={{ initial: "6", sm: "8" }} className="studio-page-title">{ko.title}</Heading>
          <Text as="p" id="availability" size="2" className="studio-lead">{ko.availability}</Text>
        </div>

        <div className="studio-layout">
          <div className="studio-primary">
            <Card size="3" asChild>
              <section className="studio-panel studio-control-panel" aria-labelledby="control-title">
                <div className="studio-panel-header">
                  <div>
                    <Text as="p" size="1" className="studio-overline">{ko.studioControlOverline}</Text>
                    <Heading as="h2" id="control-title" size="5">{ko.studioControlTitle}</Heading>
                  </div>
                  <Badge color="jade" variant="outline" size="2">{ko.studioLiveEngine}</Badge>
                </div>
                <Text as="p" size="2" className="studio-panel-intro">{ko.nextStepDescription}</Text>
                <AudioSetup />
              </section>
            </Card>

            <Card size="3" asChild>
              <section className="studio-panel studio-track-panel" aria-labelledby="track-title">
                <div className="studio-panel-header">
                  <div className="studio-track-name">
                    <span className="studio-track-number" aria-hidden="true">01</span>
                    <div>
                      <Text as="p" size="1" className="studio-overline">{ko.studioTrackOverline}</Text>
                      <Heading as="h2" id="track-title" size="5">{ko.studioTrackTitle}</Heading>
                    </div>
                  </div>
                  <Badge color="gray" variant="outline">{ko.studioTrackIdle}</Badge>
                </div>
                <div className="studio-track-well">
                  <div className="studio-track-ruler" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span></div>
                  <div className="studio-track-empty">
                    <span className="studio-empty-icon" aria-hidden="true">＋</span>
                    <Text as="p" size="3" weight="medium">{ko.studioTrackEmpty}</Text>
                    <Text as="p" size="2" color="gray">{ko.studioTrackEmptyHint}</Text>
                  </div>
                </div>
                <div className="studio-track-actions">
                  <Button type="button" size="3" disabled aria-describedby="availability" className="studio-record-button">{ko.studioRecordUnavailable}</Button>
                  <Text as="p" size="1" color="gray">{ko.studioTrackLimit}</Text>
                </div>
              </section>
            </Card>
          </div>

          <aside className="studio-sidebar" aria-label={ko.studioSetupTitle}>
            <Card size="3" asChild><div className="studio-panel studio-side-panel"><MicrophoneSetup /></div></Card>
            <Card size="3" asChild><div className="studio-panel studio-side-panel"><EnvironmentDiagnostics /></div></Card>
            <Card size="3" asChild>
              <section className="studio-panel studio-side-panel" aria-labelledby="project-title">
                <Text as="p" size="1" className="studio-overline">{ko.studioProjectOverline}</Text>
                <Heading as="h2" id="project-title" size="4">{ko.studioProjectTitle}</Heading>
                <Text as="p" size="2" color="gray" mt="2">{ko.studioProjectDescription}</Text>
                <div className="studio-project-actions">
                  <Button type="button" variant="soft" disabled aria-describedby="availability">{ko.newProject}</Button>
                  <Button type="button" variant="outline" disabled aria-describedby="availability">{ko.demo}</Button>
                </div>
              </section>
            </Card>
          </aside>
        </div>
      </main>
      <footer className="studio-footer">
        <Text as="span" size="1">{ko.localFirst}</Text>
        <Text as="span" size="1">{ko.privacy}</Text>
      </footer>
    </div>
  );
}
