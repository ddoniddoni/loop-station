# Loop Station

브라우저에서 녹음하고 반복하며 소리를 쌓는 웹 루프스테이션을 만들기 위한 초기 프로젝트입니다.

**현재 범위:** Next.js 기반, 한국어 준비 화면, 박자/프레임 변환 함수, 자동 검사 환경. 실제 녹음·루핑·저장·클라우드는 아직 구현하지 않았습니다. Phase 0 전체 완료가 아닙니다.

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

E2E는 빌드된 앱을 전용 포트 3108에서 실행하고 종료합니다. 기존 서버를 재사용하지 않습니다. `test:audio`는 현재 **시간 변환 수치 테스트**이며, 실제 DSP·마이크·Worklet 검증을 뜻하지 않습니다. 단위 테스트의 관찰 모드는 `npm run test:watch`입니다.

## 구조

```text
src/app/                 App Router와 초기 화면
src/lib/i18n/            한국어 UI 문구
src/audio/transport/     React/DOM에 의존하지 않는 시간 변환
tests/audio/             시간 변환 수치 테스트
tests/e2e/               production 브라우저 테스트
docs/                    상세 명세와 실제 진행 기록
```

엔진, Worklet, Worker, IndexedDB 저장소는 해당 기능을 구현할 때 상세 명세의 책임 분리에 맞춰 추가합니다. 현재 `build`와 `dev`는 Next.js만 실행합니다. `build:audio`와 Worklet watch 파이프라인은 실제 Worklet 엔트리를 추가하는 다음 작업에서 구현합니다. 실행 내용이 없는 성공 스크립트는 만들지 않습니다.

## 문서

- [프로젝트 규칙](AGENTS.md)
- [상세 설계](docs/LOOP_STATION_SPEC.md)
- [진행 상태와 검증 결과](docs/PROGRESS.md)

다음 작업은 Phase 0의 사용자 동작 기반 AudioContext, Worklet 로딩, 마이크 선택/거부 처리, 환경 진단입니다. 녹음·연주 구현 전까지 홈의 기능 버튼은 이유와 함께 비활성화합니다.

Git 저장소 초기화, 브랜치 생성, commit, push, 배포는 별도의 명시적 요청이 있을 때만 진행합니다.
