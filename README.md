# Loop Station

브라우저에서 녹음하고 반복하며 소리를 쌓는 웹 루프스테이션을 만들기 위한 초기 프로젝트입니다.

**현재 범위:** Radix 기반 Stitch 콘솔, 오디오 시계·메트로놈, 마이크 입력 조절과 01 트랙의 4마디 PCM 녹음·반복·오버더빙을 구현했습니다. 실제 장치 녹음·청취 검증은 아직 하지 않았습니다. 다중 트랙·저장·클라우드는 준비 중입니다.

상단 `AUDIO`에서 오디오를 시작하고, `입력 설정`에서 마이크를 연결한 뒤 01 트랙의 `RECORD 4 BARS`를 누릅니다. 다음 마디부터 4마디를 녹음하고 자동으로 반복합니다. 녹음 취소·반복 정지·재시작과 비운 루프 복구를 제공합니다. **녹음은 현재 탭의 메모리에만 보관되며 새로고침하면 사라집니다.**

반복 중 `오버더빙 · 1회`를 누르면 다음 루프부터 한 바퀴 덧녹음합니다. 취소하거나 입력이 끊기면 기존 루프를 유지합니다. `Undo`와 `Redo`는 직전 오버더빙 한 번을 되돌리고 다시 적용합니다. 재생 중에는 다음 루프 경계에서 적용하고, 대기 중인 예약은 취소할 수 있습니다.

## 실행

Node.js 24 LTS를 권장합니다(`.nvmrc`). Node.js 26 안정 버전도 허용합니다. 패키지 관리자는 npm 11입니다.

```bash
cd /Users/ddoni/dev/loop-station
# nvm을 사용하는 경우: nvm use
npm ci
npm run dev
```

http://localhost:3000 에서 확인합니다. 환경변수나 외부 계정은 필요하지 않습니다. 의존성이 설치되어 있으면 `npm run dev`만 실행하면 됩니다.

## 검사

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E는 빌드된 앱을 전용 포트 3108에서 실행하고 종료합니다. 기존 서버를 재사용하지 않습니다. `test:audio`는 시간 변환과 PCM 루프 코어의 합성 입력 테스트이며, 실제 마이크·Worklet 로딩·실청취 검증을 대신하지 않습니다. 새 PCM 테스트는 사용자 요청에 따라 아직 실행하지 않았습니다. 단위 테스트의 관찰 모드는 `npm run test:watch`입니다.

## 구조

```text
src/app/                 App Router와 초기 화면
src/lib/i18n/            한국어 UI 문구
src/audio/transport/     React/DOM에 의존하지 않는 시간 변환
src/audio/loop/          단일 트랙 PCM 녹음·오버더빙·반복과 Undo/Redo
tests/audio/             시간 변환·PCM 코어 테스트
tests/e2e/               production 브라우저 테스트
docs/                    상세 명세와 실제 진행 기록
```

`build`와 `dev`는 `build:audio`로 AudioWorklet을 먼저 번들링합니다. 개발 중 Worklet 코드를 바꿀 때는 별도 터미널에서 `npm run watch:audio`를 실행하고 오디오를 다시 시작합니다. IndexedDB 저장은 아직 구현하지 않았습니다.

## 문서

- [프로젝트 규칙](AGENTS.md)
- [상세 설계](docs/LOOP_STATION_SPEC.md)
- [진행 상태와 검증 결과](docs/PROGRESS.md)

다음 기능은 확정한 루프의 로컬 저장입니다. 테스트 재개 요청 이후에는 실제 Worklet 로딩, 권한·장치 수명, PCM 녹음·오버더빙·Undo/Redo와 중단 처리를 먼저 검증합니다. 미구현 기능 버튼은 이유와 함께 비활성화합니다.

Git 저장소 초기화, 브랜치 생성, commit, push, 배포는 별도의 명시적 요청이 있을 때만 진행합니다.
