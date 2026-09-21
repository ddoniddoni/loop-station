import { StudioIcon, type StudioIconName } from "@/components/ui/studio-icon";

export type StudioView = "tracks" | "library" | "mixer" | "fx" | "settings";
const destinations: { id: StudioView; label: string; icon: StudioIconName }[] = [
  { id: "tracks", label: "Loops", icon: "loop" },
  { id: "library", label: "Library", icon: "folder" },
  { id: "mixer", label: "Mixer", icon: "mixer" },
  { id: "fx", label: "FX", icon: "wave" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function StudioNavigation() {
  return (
    <nav className="station-navigation-header" aria-label="스튜디오 메뉴">
      <a href="#project">Project</a>
      <span aria-disabled="true" title="편집 기능은 준비 중입니다">Edit</span>
      <a className="is-current" href="#tracks">Track</a>
      <a href="#mixer">View</a>
    </nav>
  );
}

export function StudioMobileNavigation({ view, onNavigate }: { view: StudioView; onNavigate: (view: StudioView) => void }) {
  return (
    <nav className="station-navigation-mobile" aria-label="스튜디오 하단 메뉴">
      {destinations.map(({id, label, icon}) => <button type="button" key={id} aria-current={view === id ? "page" : undefined} onClick={() => onNavigate(id)}><StudioIcon name={icon} /><span>{label}</span></button>)}
    </nav>
  );
}
