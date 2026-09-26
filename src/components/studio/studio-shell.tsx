import { Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { AudioSetup } from "@/components/audio/audio-setup";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";
import { LoopSaveStatus } from "./loop-save-status";
import { MicrophoneConnection } from "./microphone-connection";
import { StudioNavigation } from "./studio-navigation";

export function StudioShell({ children }: { children: ReactNode }) {
  return <div className="station-app">
    <a className="skip-link" href="#main">{ko.skipToContent}</a>
    <header className="station-header">
      <div className="station-identity"><StudioIcon name="wave" size={24} /><Text as="span" className="station-wordmark">LOOP//STATION</Text><span className="station-edition">WEB</span></div>
      <StudioNavigation />
      <div className="station-session"><Text weight="bold">로컬 프로젝트</Text><LoopSaveStatus /></div>
      <MicrophoneConnection />
      <AudioSetup />
    </header>
    <main id="main" className="station-main" tabIndex={-1}>{children}</main>
  </div>;
}
