# 개발 진행 기록

## 현재 상태

- 기준일: 2026-09-21
- 프로젝트 상태: **프로젝트 기본 구성 완료. Phase 0은 부분 구현.**
- 프로젝트 위치: `/Users/ddoni/dev/loop-station`. Next.js App Router 기반 한국어 준비 화면과 순수 시간 변환 함수를 생성함.
- 검증: npm install, lint, typecheck, 단위 테스트 21개, production build, Chromium 데스크톱/모바일 E2E 2개 통과. 실제 오디오 처리는 미구현·미검증.
- 다음 작업: 사용자가 다음 구현을 요청하면 Phase 0의 AudioContext, Worklet 빌드/로딩, 마이크 권한 흐름, 환경 진단을 구현.
- 상세 명세: `LOOP_STATION_SPEC.md`

이 문서의 표는 완료 보고용 장식이 아니라 실제 구현 추적용이다. 가짜 입력으로 검증한 항목은 그 범위를 밝히고, 실제 마이크/브라우저/클라우드에서 미검증한 항목은 따로 남긴다.

## 상태 규칙

`미착수`, `진행 중`, `부분 구현`, `구현 완료/미검증`, `검증 완료`, `조건부 비활성`, `차단됨`을 구분한다. 구현을 시작하지 않았는데 검증 완료로 변경하지 않는다. 조건부 비활성은 미구현 기능을 숨기는 용도로 쓰지 않는다. 환경/설정 근거와 남은 검증을 기록한다.

## 단계 진행

| Phase | 목표 | 상태 | 증거/다음 작업 |
|---|---|---|---|
| 0 | 저장소와 실제 오디오 기반 | 부분 구현 | SYS-01 검증. 실제 오디오 엔진과 Worklet은 미착수 |
| 1 | 한 트랙 녹음과 공통 시계 | 미착수 | Phase 0 후 진행 |
| 2 | 8트랙, 오버더빙, 로컬 저장 | 미착수 | 실제 PCM과 Undo 검증 |
| 3 | 편집, 지연 보정, 파일 입출력 | 미착수 | 기본 루핑 제품 완성 목표 |
| 4 | FX, 장면, 내부 녹음 | 미착수 | 라우팅/공연 녹음 검증 |
| 5 | MIDI, 리듬, 자동화, 곡 구성 | 미착수 | 내부 악기와 컨트롤러 기능 |
| 6 | 고급 DSP와 고급 루프 | 미착수 | 변환 음질/성능 게이트 |
| 7 | 선택적 Supabase 클라우드 | 미착수 | 사용자 활성화 및 환경 필요 |
| 8 | 출시 검증 | 미착수 | 지원 범위와 실제 측정값 확정 |

## 요구사항 추적

관련 기준은 상세 명세 3절을 확인한다. 테스트와 증거에는 파일 경로, 테스트명, 실행일, 실제 장치/브라우저 조건을 기록한다.

| ID | 기능 | 주 Phase | 상태 | 실제 검증/남은 항목 |
|---|---|---:|---|---|
| SYS-01 | 프로젝트 기반 | 0 | 검증 완료 | App Router, React, TS strict, npm lockfile, lint/typecheck/test/build 및 production E2E 통과 |
| SYS-02 | 로컬 우선 실행 | 2 | 미착수 | — |
| SYS-03 | 안전한 오디오 시작 | 0 | 미착수 | — |
| SYS-04 | 환경 진단 | 0 | 미착수 | — |
| IN-01 | 입력 장치와 채널 선택 | 1 | 미착수 | — |
| IN-02 | 입력 게인과 모니터링 | 1 | 미착수 | — |
| IN-03 | 녹음 지연 보정 | 3 | 미착수 | — |
| CLK-01 | 공통 트랜스포트 | 1 | 미착수 | — |
| CLK-02 | 메트로놈 | 1 | 미착수 | — |
| CLK-03 | 퀀타이즈와 고정 길이 | 1 | 미착수 | — |
| CLK-04 | 첫 루프로 템포 설정 | 2 | 미착수 | — |
| CLK-05 | 장시간 동기화 | 2 | 미착수 | — |
| CLK-06 | 템포 변경 정책 | 6 | 미착수 | — |
| LOOP-01 | 다중 트랙 | 2 | 미착수 | — |
| LOOP-02 | 녹음과 오버더빙 | 2 | 미착수 | — |
| LOOP-03 | Undo, Redo, Clear | 2 | 미착수 | — |
| LOOP-04 | Replace와 Feedback | 4 | 미착수 | — |
| LOOP-05 | 재생과 정지 모드 | 3 | 미착수 | — |
| LOOP-06 | 리버스와 배속 | 3 | 미착수 | — |
| LOOP-07 | 루프 길이 배수 편집 | 3 | 미착수 | — |
| LOOP-08 | 파형 편집 | 3 | 미착수 | — |
| LOOP-09 | 소리 감지 녹음 | 4 | 미착수 | — |
| LOOP-10 | 최근 연주 가져오기 | 4 | 미착수 | — |
| LOOP-11 | 내부 바운스와 리샘플링 | 4 | 미착수 | — |
| LOOP-12 | 동기/자유 루프 | 3 | 미착수 | — |
| LOOP-13 | 인트로와 테일 | 6 | 미착수 | — |
| PERF-01 | 클립과 장면 | 4 | 미착수 | — |
| PERF-02 | 그룹과 상호 배타 재생 | 4 | 미착수 | — |
| PERF-03 | Follow Action과 곡 순서 | 5 | 미착수 | — |
| PERF-04 | 자동화 | 5 | 미착수 | — |
| PERF-05 | 사용자 지정 연주 화면 | 5 | 미착수 | — |
| PERF-06 | 세트리스트 | 5 | 미착수 | — |
| PERF-07 | 공연 모드와 비상 정지 | 3 | 미착수 | — |
| MIX-01 | 트랙 믹서 | 2 | 미착수 | — |
| MIX-02 | 입출력 라우팅 | 4 | 미착수 | — |
| FX-01 | 이펙트 랙 | 4 | 미착수 | — |
| FX-02 | 기본 다이내믹과 필터 | 4 | 미착수 | — |
| FX-03 | 공간과 드라이브 | 4 | 미착수 | — |
| FX-04 | 연주용 변조 이펙트 | 6 | 미착수 | — |
| FX-05 | FX 프리셋과 매크로 | 5 | 미착수 | — |
| FX-06 | 독립 시간/음정 변환 | 6 | 미착수 | — |
| RHY-01 | 드럼 스텝 시퀀서 | 5 | 미착수 | — |
| RHY-02 | 샘플 패드와 기본 악기 | 5 | 미착수 | — |
| MIDI-01 | 키보드 단축키 | 2 | 미착수 | — |
| MIDI-02 | MIDI Learn과 풋 컨트롤 | 5 | 미착수 | — |
| MIDI-03 | MIDI 클립 | 5 | 미착수 | — |
| MIDI-04 | 외부 MIDI 동기화 | 6 | 미착수 | — |
| FILE-01 | 오디오 가져오기 | 3 | 미착수 | — |
| FILE-02 | 로컬 자동 저장 | 2 | 미착수 | — |
| FILE-03 | 프로젝트 아카이브 | 3 | 미착수 | — |
| FILE-04 | 믹스와 스템 WAV | 3 | 미착수 | — |
| FILE-05 | 전체 공연 녹음 | 4 | 미착수 | — |
| FILE-06 | 복구와 버전 관리 | 3 | 미착수 | — |
| CLOUD-01 | 선택적 계정과 프로젝트 | 7 | 미착수 | — |
| CLOUD-02 | 사용자 데이터 보안 | 7 | 미착수 | — |
| CLOUD-03 | 재시도 가능한 동기화 | 7 | 미착수 | — |
| CLOUD-04 | 읽기 전용 링크 공유 | 7 | 미착수 | — |
| UX-01 | 통합 작업 화면 | 4 | 미착수 | — |
| UX-02 | 반응형과 접근성 | 8 | 미착수 | — |
| UX-03 | 첫 사용 안내와 데모 | 2 | 미착수 | — |
| QA-01 | 오디오 회귀 검증 | 8 | 미착수 | — |
| QA-02 | 성능과 브라우저 게이트 | 8 | 미착수 | — |
| QA-03 | 배포와 오프라인 안전성 | 8 | 미착수 | — |
| QA-04 | 완료 보고의 정확성 | 8 | 미착수 | — |

## 환경과 의존성 기록

| 항목 | 실제 값 |
|---|---|
| Node/npm | 실제 검증: Node 26.4.0 / npm 11.17.0. `.nvmrc`는 Node 24 LTS 권장값이며 Node 24 실행은 별도 미검증 |
| Next.js/React/TypeScript | Next.js 16.3.5 / React·React DOM 19.3.0 / TypeScript 5.9.3 |
| 스타일/검사 도구 | Tailwind CSS 4.3.3 / ESLint 9.39.5 / Vitest 5.0.1 / Playwright 1.63.0 |
| 로컬 저장 래퍼 | 미선택 |
| Worklet 빌드 도구/메시지 버전 | 미선택 |
| Stretch DSP 패키지/버전/라이선스 | 도입 단계에서 공식 배포 검증 필요 |
| Supabase 사용 여부 | 기본 로컬 모드. 클라우드 미설정 |
| 기준 브라우저/OS/장치/sampleRate | macOS 26.6.2 arm64, Chromium 153.0.8010.12 headless. Desktop Chrome / Pixel 7 viewport 에뮬레이션. 실제 장치와 sampleRate 미측정 |
| 녹음 보정값과 측정 경로 | 미측정 |
| PCM 예산과 성능 프로파일 | 설계 기본값만 존재. 실측 필요 |

## 구현 결정 기록

| 날짜 | 결정 | 근거 | 영향받는 요구사항 | 검증/남은 위험 |
|---|---|---|---|---|
| 2026-09-21 | Next.js, React, npm 사용 | 첨부 명세의 기술 선택 | SYS-01 | 기반 구성과 자동 검증 완료 |
| 2026-09-21 | 서버 DB가 필요하면 Supabase | 첨부 명세의 기술 선택 | CLOUD-01~04 | 클라우드 선택 시 검증 |
| 2026-09-21 | 로컬 우선, 오디오 시계는 브라우저 엔진 | 상세 명세의 설계 결정 | SYS-02, CLK, LOOP | 실제 오디오 검증 필요 |
| 2026-09-21 | 이번 작업은 프로젝트 생성과 기본 구성으로 한정 | 사용자의 요청은 문서 확인 및 /Users/ddoni/dev 내 프로젝트 생성. 첨부 문서의 첫 실행 프롬프트는 별도 구현 요청으로 취급하지 않음 | SYS-01 | Phase 0 전체 또는 루핑 기능을 완료로 표시하지 않음 |
| 2026-09-21 | TypeScript 5.9.3, ESLint 9 계열 유지 | 공식 create-next-app 템플릿과 설치된 eslint-plugin-react의 peer 범위. typescript-eslint는 TypeScript <6.1 요구 | SYS-01 | npm의 최신 TS 7.0.2, ESLint 10을 호환 확인 없이 도입하지 않음. ESLint 9의 지원 종료 경고는 남음 |
| 2026-09-21 | 초기 화면은 Server Component, 시간 변환은 React/DOM 없는 모듈 | 브라우저 API의 서버 실행 방지와 향후 DSP 테스트 공유 | SYS-01, CLK-01 기반 | 마이크/AudioContext/저장소 초기화 없음. CLK-01 트랜스포트는 아직 미구현 |
| 2026-09-21 | Worklet 빌드 스크립트는 실제 엔트리 구현과 함께 추가 | 이번 요청 범위에는 Worklet 구현이 포함되지 않음 | SYS-03, SYS-04 | 빈 성공 스크립트 없음. 현재 dev/build는 Next.js만 실행 |
| 2026-09-21 | Git 미초기화 | Git 동작은 해당 동작의 명시적 요청이 있어야 함 | SYS-01 | init/branch/commit/push/PR/배포 미실행 |

## 검증 로그

### 2026-09-21 — 프로젝트 생성 / SYS-01

- 변경 파일: AGENTS.md, CLAUDE.md, docs/PROGRESS.md, docs/LOOP_STATION_SPEC.md(원본 그대로 복사), README.md, package.json, package-lock.json, .nvmrc, .npmrc, .gitignore, .editorconfig, tsconfig.json, next-env.d.ts, next.config.ts, eslint.config.mjs, postcss.config.mjs, vitest.config.mts, playwright.config.ts, src/app/{layout.tsx,page.tsx,globals.css}, src/lib/i18n/ko.ts, src/audio/transport/timing.ts, tests/audio/timing.test.ts, tests/e2e/home.spec.ts.
- 원본 보존: Downloads 문서 패키지는 수정하지 않음. 상세 명세는 원본과 SHA-256 일치(3acc20143ad2ff491468bc10e5b76b94aebcf4561b327b002ca3a091d89252b4). AGENTS.md는 원본에 사용자 Git 규칙과 Next.js 생성기 지침을 병합함.
- 공식 정보 확인: [Next.js 설치 문서](https://nextjs.org/docs/app/getting-started/installation), 설치된 node_modules/next/dist/docs의 layout/CSS/Vitest 문서, npm view의 버전/engines/peerDependencies. create-next-app 16.3.5의 --disable-git --skip-install --empty 옵션 사용.

| 실행 명령 | 실제 결과 |
|---|---|
| node --version / npm --version | v26.4.0 / 11.17.0 |
| npm install | 성공. 390개 패키지 추가, npm audit 취약점 0개 |
| npm ls --depth=0 | 성공. 직접 의존성 버전 확인, peer 오류 없음 |
| npm run lint | 성공. 경고 0개 기준 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| npm run test | 1개 파일, 21개 테스트 통과 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 성공. / 및 /_not-found 정적 생성 |
| npm exec -- playwright install chromium | Chromium / headless shell revision 1243 설치 성공 |
| npm run test:e2e | production 서버에서 desktop/mobile Chromium 각 1개, 총 2개 통과 |
| npm exec --package=react-doctor@latest -- react-doctor --verbose --scope changed | Git 미초기화로 전체 스캔 자동 전환. 12개 파일, 100/100, 진단 없음 |
| npm run start -- --hostname 127.0.0.1 --port 3109 | 시각 검수용 production 서버 정상 실행 |

- 수치 테스트 범위: 48kHz/120BPM/4마디 → 384,000프레임 계산, 3/4·4/4·6/8·7/8, 템포 앵커, 44.1/48kHz·123.45BPM의 320마디 절대 경계 계산, 잘못된 수치 거부. AUDIO-01/02/03의 **시간 계산 부분만** 검증했으며 PCM 캡처/장시간 재생을 검증한 것이 아님.
- E2E 범위: 한국어/메타데이터, 미구현 버튼 비활성, 마이크 미사용 안내, 키보드 본문 건너뛰기, 화면 가로 넘침 없음, pageerror 없음. 모바일 테스트는 실제 휴대전화가 아닌 viewport 에뮬레이션.
- 초기 환경 제약: 기본 샌드박스에서 npm DNS와 Ego 브라우저 연결이 실패했으나 승인된 외부 실행으로 재시도하여 설치와 공식 문서 확인 성공.
- 설치 경고: ESLint 9.39.5 지원 종료 안내, unrs-resolver postinstall 미승인 안내가 있었음. 강제 승인하지 않았으며 실제 lint/typecheck/test/build/E2E는 모두 통과함. E2E의 NO_COLOR/FORCE_COLOR 충돌 안내는 테스트 결과와 무관한 실행 환경 경고.
- 미실행: npm ci 재설치, Node 24 실행, 실제 마이크 권한/실청취/하드웨어 지연/Worklet 로딩/PCM 녹음/저장/클라우드 권한 테스트. 해당 기능은 아직 구현 전.
- 시각 검수: Playwright CLI로 1280×900 데스크톱 및 393×851 모바일 화면을 캡처. Ego는 0×0 viewport와 captureScreenshot 시간 초과가 발생해 캡처 경로를 전환함.
- 저장 포맷/migration: 생성 또는 변경 없음.

### 2026-09-21 — 프로젝트 Git 규칙 중복 제거

- 제품 요구사항 ID: 해당 없음(작업 규칙 정리).
- 변경 파일: `AGENTS.md`, `docs/PROGRESS.md`.
- 프로젝트 `AGENTS.md`의 Git Flow 문단과 중복 Git 작업 규칙을 삭제함. 앞으로 Git 작업은 사용자 Codex 설정의 `/Users/ddoni/.codex/AGENTS.md`를 기준으로 함.
- 실행 결과: `git diff --check`, `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build` 모두 성공. 사용자 요청에 따라 단위·E2E 테스트는 실행하지 않음.
- Git 작업: 이 정리는 별도 chore 브랜치로 분리하고 기존 기능 변경은 보존함.

## 알려진 제한과 차단 항목

프로젝트 기반만 준비되었다. AudioContext, AudioWorklet, 환경 진단, 마이크 권한 흐름, PCM 녹음, 루핑, 저장, FX, MIDI, 클라우드 기능은 미구현이다. 화면은 이 상태를 명시하며 새 프로젝트/데모 버튼은 이유와 함께 비활성화한다. 외부 폰트나 오디오 에셋 요청 없이 기본 화면을 렌더한다.

시간 변환 단위 테스트는 실제 오디오 시계의 동작이나 장시간 동기화를 보장하지 않는다. 실제 마이크·헤드폰·인터페이스 청취 및 Chrome/Edge/Firefox/Safari 지원 범위 검증은 남아 있다.

## 다음 Codex 작업

사용자가 구현을 요청하면 AGENTS.md와 현재 진행 상태를 읽고 **남은 Phase 0**을 이어간다. 사용자 클릭으로 시작하는 AudioContext, 실제 Worklet 엔트리와 build/watch 파이프라인, 테스트 신호, 마이크 선택/거부·취소 흐름, 모니터 기본 OFF, 환경 진단을 가장 작은 기능 단위로 구현한다. production Worklet URL, 브라우저 실제 오디오 처리, 중복 Context 방지, dispose를 검증한 뒤 Phase 0 완료 여부를 판단한다.
