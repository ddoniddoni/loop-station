import { Badge, Heading, Text } from "@radix-ui/themes";
import { AudioSetup } from "@/components/audio/audio-setup";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { StudioNavigation } from "@/components/studio/studio-navigation";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

export default function Home() {
  return (
    <div className="station-app">
      <a className="skip-link" href="#main">{ko.skipToContent}</a>

      <header className="station-header">
        <div className="station-identity">
          <span className="station-logo"><StudioIcon name="wave" size={26} /></span>
          <Text as="span" className="station-wordmark">Loop<span>Station</span></Text>
          <Badge color="gray" variant="soft">{ko.studioPreview}</Badge>
        </div>
        <StudioNavigation placement="header" />
        <div className="station-session">
          <Heading as="h1" size="4">{ko.studioSessionName}</Heading>
          <div className="station-session-meta">
            <span className="station-led is-unsaved" aria-hidden="true" />
            <Text as="span" size="1">{ko.studioUnsaved}</Text>
          </div>
        </div>
      </header>

      <main id="main" className="station-main" tabIndex={-1}>
        <div className="station-availability">
          <StudioIcon name="info" size={18} />
          <p id="availability">{ko.availability}</p>
        </div>
        <section className="station-transport-rack" aria-label={ko.studioControlTitle}>
          <AudioSetup />
        </section>
        <StudioWorkspace />
      </main>

      <footer className="station-footer">
        <Text as="span" size="1">{ko.localFirst}</Text>
        <Text as="span" size="1">{ko.privacy}</Text>
      </footer>
    </div>
  );
}
