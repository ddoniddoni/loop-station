"use client";

import { Button, DropdownMenu } from "@radix-ui/themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudioIcon, type StudioIconName } from "@/components/ui/studio-icon";
import { useStudioView, type StudioView } from "./studio-view-provider";

const destinations: { id: StudioView; label: string; icon: StudioIconName }[] = [
  { id: "studio", label: "전체 작업 화면", icon: "loop" },
  { id: "tracks", label: "트랙", icon: "tracks" },
  { id: "mixer", label: "믹서", icon: "mixer" },
  { id: "settings", label: "입력·트랙 설정", icon: "settings" },
];

export function StudioNavigation() {
  const pathname = usePathname();
  const { view, setView } = useStudioView();
  const inStudio = pathname === "/";
  return (
    <nav className="station-navigation-header" aria-label="스튜디오 메뉴">
      <Link href="/projects" aria-current={pathname === "/projects" ? "page" : undefined}>내 프로젝트</Link>
      <Link href="/" aria-current={inStudio ? "page" : undefined}>스튜디오</Link>
      {inStudio && <DropdownMenu.Root>
        <DropdownMenu.Trigger><Button variant="ghost" color="gray" aria-label="View · 화면 보기 설정">View · 보기<DropdownMenu.TriggerIcon /></Button></DropdownMenu.Trigger>
        <DropdownMenu.Content className="station-overlay">
          <DropdownMenu.Label>작업 화면 선택</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={view} onValueChange={(value) => {
            const destination = destinations.find(({ id }) => id === value);
            if (destination) setView(destination.id);
          }}>
            {destinations.map(({ id, label }) => <DropdownMenu.RadioItem key={id} value={id}>{label}</DropdownMenu.RadioItem>)}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>}
    </nav>
  );
}

export function StudioMobileNavigation() {
  const { view, setView } = useStudioView();
  return <nav className="station-navigation-mobile" aria-label="스튜디오 하단 메뉴">
    {destinations.map(({ id, label, icon }) => <button type="button" key={id} aria-pressed={view === id}
      onClick={() => setView(id)}><StudioIcon name={icon} /><span>{label}</span></button>)}
  </nav>;
}
