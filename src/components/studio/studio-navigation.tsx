import { StudioIcon, type StudioIconName } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

const destinations: { id: string; label: string; icon: StudioIconName }[] = [
  { id: "tracks", label: ko.studioTrackNav, icon: "tracks" },
  { id: "library", label: ko.studioLibraryTitle, icon: "folder" },
  { id: "mixer", label: ko.studioMixerTitle, icon: "mixer" },
  { id: "settings", label: ko.studioSetupTitle, icon: "settings" },
];

export function StudioNavigation({ placement }: { placement: "header" | "mobile" }) {
  return (
    <nav className={`station-navigation station-navigation-${placement}`} aria-label={ko.studioNavigation}>
      {destinations.map(({ id, label, icon }) => (
        <a key={id} href={`#${id}`}><StudioIcon name={icon} /><span>{label}</span></a>
      ))}
    </nav>
  );
}
