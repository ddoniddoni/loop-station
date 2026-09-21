import { Heading, Text } from "@radix-ui/themes";
import { AudioSetup } from "@/components/audio/audio-setup";
import { AudioEngineProvider } from "@/components/audio/audio-engine-provider";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { StudioNavigation } from "@/components/studio/studio-navigation";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

export default function Home() {
  return (
    <AudioEngineProvider>
      <div className="station-app">
        <a className="skip-link" href="#main">{ko.skipToContent}</a>
        <header className="station-header">
          <div className="station-identity"><StudioIcon name="wave" size={24} /><Text as="span" className="station-wordmark">LOOP//STATION</Text><span className="station-edition">WEB</span></div>
          <StudioNavigation />
          <div className="station-session"><Heading as="h1" size="3">{ko.studioSessionName}</Heading><span>저장되지 않음 · LOCAL</span></div>
          <AudioSetup />
        </header>
        <main id="main" className="station-main" tabIndex={-1}>
          <details className="station-availability"><summary><StudioIcon name="info" size={13} /><span>프리뷰 · 01 트랙 4마디 녹음</span><span>사용 가능 기능 안내</span></summary><p id="availability">{ko.availability}</p><p>{ko.privacy}</p></details>
          <StudioWorkspace />
        </main>
      </div>
    </AudioEngineProvider>
  );
}
