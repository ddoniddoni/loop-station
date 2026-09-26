import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { StudioIcon } from "@/components/ui/studio-icon";
import { ko } from "@/lib/i18n/ko";

export default function Home() {
  return <>
    <h1 className="sr-only">루프 스튜디오</h1>
    <details className="station-availability"><summary><StudioIcon name="info" size={13} /><span>프리뷰 · 8트랙 루프 스테이션</span><span>사용 가능 기능 안내</span></summary><p id="availability">{ko.availability}</p><p>{ko.privacy}</p></details>
    <StudioWorkspace />
  </>;
}
