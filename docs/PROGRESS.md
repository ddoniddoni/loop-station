# 개발 진행 기록

## 현재 상태

- 기준일: 2026-09-22
- 프로젝트 상태: **프로젝트 기본 구성 완료. Phase 0은 부분 구현·미검증, Phase 1은 공통 시계·메트로놈·마이크 입력 조절까지 부분 구현.**
- 프로젝트 위치: `/Users/ddoni/dev/loop-station`. Next.js App Router 기반 한국어 준비 화면과 순수 시간 변환 함수를 생성함.
- UI 기반: Radix Themes 3.3.0을 유지하고 Stitch 원본 이미지와 디자인 시스템을 다시 확인해 64px 상단 콘솔, 데스크톱 4×2 트랙·좌우 패널·하단 믹서의 밀도와 색상을 복원함. Geist·Pretendard·JetBrains Mono 로컬 폰트, 모바일 4트랙 뱅크 전환·하단 5칸 메뉴를 적용함. 실제 마이크 입력 설정은 인스펙터의 Radix Dialog로 이동함. 실제 녹음·믹서는 미구현 상태를 표시함.
- 검증: 이전 Radix 작업의 단위 테스트 21개와 Chromium E2E 2개 통과 기록은 아래 로그 참조. 이후 오디오·마이크·환경 진단·공통 시계·메트로놈·입력 게인/미터/모니터링 변경은 사용자 요청에 따라 테스트를 중단했고, 실제 브라우저 권한·장치·실청취도 미검증.
- 디자인 재확인: 이번 사용자 요청 범위에서 원본 이미지 열람과 실제 DOM의 데스크톱·모바일 배치 치수, 설정창 표시만 확인함. 캡처 도구 시간 초과로 구현 화면의 스크린샷 비교는 미완료이며, 오디오·마이크 기능을 시작하지 않음.
- 다음 작업: 사용자 요청 후 Worklet, 마이크 권한·장치, 환경 진단, 공통 시계와 메트로놈을 실제 브라우저에서 검증. 그 전에는 Phase 0과 CLK-01/02를 완료로 표시하지 않음.
- 상세 명세: `LOOP_STATION_SPEC.md`

이 문서의 표는 완료 보고용 장식이 아니라 실제 구현 추적용이다. 가짜 입력으로 검증한 항목은 그 범위를 밝히고, 실제 마이크/브라우저/클라우드에서 미검증한 항목은 따로 남긴다.

## 상태 규칙

`미착수`, `진행 중`, `부분 구현`, `구현 완료/미검증`, `검증 완료`, `조건부 비활성`, `차단됨`을 구분한다. 구현을 시작하지 않았는데 검증 완료로 변경하지 않는다. 조건부 비활성은 미구현 기능을 숨기는 용도로 쓰지 않는다. 환경/설정 근거와 남은 검증을 기록한다.

## 단계 진행

| Phase | 목표 | 상태 | 증거/다음 작업 |
|---|---|---|---|
| 0 | 저장소와 실제 오디오 기반 | 부분 구현 | SYS-01 검증. 사용자 시작/종료, 테스트 신호 Worklet, 마이크 권한·장치 UI와 환경 진단 구현. 실제 브라우저 검증은 남음 |
| 1 | 한 트랙 녹음과 공통 시계 | 부분 구현 | Worklet 시계·클릭과 같은 AudioContext에 모노 입력 게인·피크/RMS·소리 듣기 연결. 채널 선택, AUTO 모니터링, Tap Tempo, 카운트인, 퀀타이즈, PCM 녹음·반복 및 실제 검증은 남음 |
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
| SYS-03 | 안전한 오디오 시작 | 0 | 부분 구현 | AudioContext/Worklet과 마이크 요청을 분리. 권한 거부·장치 없음·읽기 실패·제약 불일치·대기 취소·연결 끊김 안내 코드 구현. 실제 브라우저 검증은 남음 |
| SYS-04 | 환경 진단 | 0 | 구현 완료/미검증 | AudioContext sampleRate와 마이크 `getSettings()`의 채널·처리 설정 표시. 버튼을 누르면 AudioWorklet·마이크·MIDI·IndexedDB API, 보안 연결·격리 모드, 저장소 사용량/할당량 추정과 영구 저장 허용 상태를 읽음. API 존재와 실제 동작은 구분하며 브라우저 검증은 남음 |
| IN-01 | 입력 장치와 채널 선택 | 1 | 부분 구현 | 허용 후 입력 장치 목록과 전환 UI 구현. 채널 선택·녹음 라우팅 및 실제 장치 검증은 남음 |
| IN-02 | 입력 게인과 모니터링 | 1 | 부분 구현 | 모노 입력 버스, −24~+24 dB 게인, Worklet PCM 피크/RMS·클리핑 유지 표시, 기본 OFF 모니터와 독립 음량 구현. 장치 전환·오디오 중단 때 모니터 OFF. 실제 입력 처리 설정 표시는 기존 기능 유지. AUTO·음성 보정 옵션 변경·실청취·브라우저 검증은 남음 |
| IN-03 | 녹음 지연 보정 | 3 | 미착수 | — |
| CLK-01 | 공통 트랜스포트 | 1 | 부분 구현 | 현재 테스트 신호 Worklet에서 처리한 실제 프레임 수로 시작·정지·초기화와 40~240 BPM, 3/4·4/4·6/8·7/8 위치를 계산. UI에 마디·박 표시. Tap Tempo, 녹음·루프 연동과 브라우저 검증은 남음 |
| CLK-02 | 메트로놈 | 1 | 부분 구현 | Worklet 오디오 프레임에서 절대 beat tick의 경계를 계산해 마디 첫 박 강박·나머지 약박을 별도 출력으로 생성. ON/OFF·0~100 음량 제공. 6/8 세부 악센트 묶음, 카운트인 전용/항상 모드, 실제 실청취·WAV 제외 검증은 남음 |
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
| UX-01 | 통합 작업 화면 | 4 | 부분 구현 | Stitch 원본 기준 64px 콘솔·4×2 트랙·라이브러리·인스펙터·믹서 재배치. 실제 트랙 선택·모바일 뱅크/패널 전환과 입력 설정창 제공. 녹음·클립·믹서·FX는 미구현이며 스크린샷 비교는 미완료 |
| UX-02 | 반응형과 접근성 | 8 | 부분 구현 | Geist·Pretendard·JetBrains Mono 로컬 폰트, 컴팩트 콘솔·56px 트랙 주요 조작·44px 설정창 조작, 포커스·reduced-motion·safe area 구현. 1280px/390px DOM 배치와 가로 넘침 확인. 키보드·터치·스크린리더 및 기능 테스트는 보류 |
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
| 스타일/검사 도구 | Radix Themes 3.3.0 / Tailwind CSS 4.3.3(레이아웃 유틸리티) / ESLint 9.39.5 / Vitest 5.0.1 / Playwright 1.63.0 |
| 웹폰트 | Pretendard Variable v1.3.9, 공식 WOFF2 2,057,688 bytes. next/font/local, display swap, preload false. SIL OFL 1.1 라이선스를 public/fonts/pretendard-OFL.txt에 포함 |
| 추가 웹폰트 | Google Fonts 공식 배포 Geist 가변 TTF 169,056 bytes, JetBrains Mono 가변 TTF 187,208 bytes. 2026-09-22 다운로드, next/font/local·display swap·preload false. OFL을 public/fonts/{geist,jetbrains-mono}-OFL.txt에 포함 |
| 로컬 저장 래퍼 | 미선택 |
| Worklet 빌드 도구/메시지 버전 | esbuild 0.28.2. 테스트 신호용 `start`/`stop` 명령과 `playing`/`stopped` 응답. 입력 미터에는 경로 revision을 붙여 해제·재연결 이전 메시지를 무시함. Looper 명령 계약은 미설계 |
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
| 2026-09-21 | Worklet 빌드 스크립트는 실제 엔트리 구현과 함께 추가 | 당시 프로젝트 생성 범위에는 Worklet 구현이 포함되지 않았음 | SYS-03, SYS-04 | 이번 오디오 작업에서 실제 엔트리와 함께 추가함 |
| 2026-09-21 | Git 미초기화 | Git 동작은 해당 동작의 명시적 요청이 있어야 함 | SYS-01 | init/branch/commit/push/PR/배포 미실행 |
| 2026-09-21 | Radix Themes를 UI 기반으로 사용 | 사용자가 디자인 시스템 선택. React 19와 호환되는 공식 npm 3.3.0을 확인해 고정 설치 | UX-01, UX-02 기반 | App Router 루트에 테마 적용, 준비 화면과 production E2E 검증. 실제 스튜디오 컨트롤은 기능 구현 때 연결 |
| 2026-09-21 | 마이크 없이 개발용 440Hz 테스트 신호로 Worklet 경로를 먼저 연결 | Phase 0의 작은 수직 기능 단위. 브라우저 오디오 프레임 안에서 신호를 만들고 명시적 시작·종료를 제공 | SYS-03, SYS-04 | 실청취·브라우저 Worklet 로딩은 사용자 테스트 재개 요청 전까지 미검증. 루핑 엔진과 별개인 임시 신호 |
| 2026-09-21 | production 빌드는 Next.js의 webpack 옵션 사용 | 이 실행 환경에서 Turbopack의 PostCSS 작업 프로세스가 포트 바인딩 거부로 중단됨. Next.js 16.3.5의 공식 `--webpack` 옵션에서는 빌드 통과 | SYS-01, SYS-03 | 개발 서버는 기본 Turbopack 설정. 다른 환경의 Turbopack 원인과 브라우저 실제 동작은 미검증 |
| 2026-09-21 | 마이크 권한은 오디오 재생과 별도 동작으로 요청 | 사용자의 명시적 선택 전 입력을 수집하지 않고, 거부 후에도 테스트 신호 경로를 유지하기 위함 | SYS-03, IN-01 | 마이크 스트림은 출력에 연결하지 않음. 취소 뒤 늦게 승인된 스트림은 즉시 종료하도록 구현했으나 브라우저 검증 전 |
| 2026-09-21 | 환경 진단은 버튼을 누른 뒤 읽기 전용 브라우저 API만 호출 | 진단 자체가 마이크·MIDI 권한 요청이나 저장소 쓰기를 시작하지 않도록 하기 위함 | SYS-04 | API 제공 여부는 실제 연결·로딩·저장 성공이 아님. `StorageManager.estimate()` 수치는 추정치. 브라우저 검증 전 |
| 2026-09-21 | 첫 공통 시계를 기존 AudioWorklet에 연결하고 오디오 처리 프레임으로만 진행 | UI 타이머를 박자 경계로 사용하지 않고 향후 PCM 녹음·루프와 같은 시계에 연결하기 위함 | CLK-01 | 테스트 신호 Worklet에 임시 통합. 템포 변경은 현재 tick을 앵커로 보존하며 명령은 다음 render block에서 반영. 실제 브라우저·장시간 동기화 미검증 |
| 2026-09-21 | 메트로놈을 공통 Worklet에서 만들고 테스트 신호와 다른 출력·게인 노드로 연결 | 클릭 경계가 UI 타이머에 의존하지 않고 이후 기본 녹음·WAV에서 클릭을 제외할 수 있는 경로를 마련 | CLK-02 | 실제 녹음·WAV 경로는 아직 없으므로 클릭 제외는 설계 상태. 실청취와 경계 측정, 6/8 묶음·카운트인은 남음 |
| 2026-09-21 | Google Stitch의 `Web Loop Station DAW` 화면을 현재 기능에 맞게 적용 | 제품 기능보다 앞서 있는 시안의 디자인 언어를 가져오되 동작하지 않는 8트랙·파형·믹서를 실제 기능처럼 표시하지 않기 위함 | UX-01, UX-02 | Radix Themes 유지. Desktop `a79d689fdc0e4efdb13e6711061a640d`, Mobile `5df701419d9c42078c1664dd002dd68d` 참고. 브라우저 시각·상호작용 검증 보류 |

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

### 2026-09-21 — Radix Themes UI 기반 / UX-01·UX-02 준비

- 변경 파일: `AGENTS.md`, `package.json`, `package-lock.json`, `src/components/ui/studio-theme.tsx`, `src/app/{layout.tsx,page.tsx,globals.css}`, `tests/e2e/home.spec.ts`, `docs/PROGRESS.md`.
- 구현: Radix Themes CSS와 전역 다크 테마(amber/slate, 중간 radius)를 연결함. 첫 화면에 Radix Card, Button, Badge, Heading, Text, Flex, Separator를 실제 사용함. Tailwind는 배치 유틸리티로 유지하고 기존 별도 색상 팔레트는 Radix 토큰으로 대체함. 미구현 기능 버튼은 설명과 연결된 비활성 상태를 유지함.
- 사용 경로: 새 화면은 `@radix-ui/themes`에서 필요한 컴포넌트를 직접 가져오면 루트 테마를 공유함. Dialog, AlertDialog, Select, Slider, Switch, Tabs 등은 패키지에 포함되지만 해당 기능을 구현할 때 실제 동작과 함께 연결함.
- 의존성 확인: 공식 Radix Themes 문서의 CSS·Theme 구성과 npm 배포 정보 확인. 3.3.0은 React 19 peer 범위를 포함함. lockfile 비교 결과 기존 패키지 버전 변경/삭제 없이 새 패키지 76개 추가됨.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm install @radix-ui/themes@3.3.0 --save-exact | 성공. npm audit 취약점 0개 |
| npm ci | lockfile 기반 재설치 성공. 467개 패키지 설치, npm audit 취약점 0개 |
| npm ls @radix-ui/themes --depth=0 | 3.3.0 확인 |
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| npm run test | 1개 파일, 21개 테스트 통과 |
| npm run build | 성공. npm ci 이후 production 빌드도 재확인 |
| npm run test:e2e | production Chromium 데스크톱/모바일 각 1개, 총 2개 통과. Radix 테마·컴포넌트·버튼 실제 배경과 기존 접근성 흐름 확인 |
| npx react-doctor@latest --verbose --scope changed | 변경 범위 3개 파일 스캔, 100/100, 진단 없음 |
| Playwright CLI 시각 확인 | 최종 production 화면 1280×900 / 393×851 캡처. 제목·설명 간격, 버튼 상태, 모바일 줄바꿈과 넘침 확인. PNG는 /tmp에만 생성 |

- 한계: 실제 녹음·루핑·저장 UI와 상태별 컨트롤은 아직 미구현이다. 데스크톱/모바일 캡처는 Chromium headless이며 실제 오디오 기기 검증이 아니다. Ego 브라우저는 0×0 뷰포트에서 캡처가 시간 초과되어 Playwright로 시각 확인함.
- 다음 작업: 남은 Phase 0의 사용자 동작 기반 AudioContext, Worklet 로딩, 마이크 권한과 환경 진단을 구현할 때 Radix 컨트롤을 실제 엔진 상태에 연결함.

### 2026-09-21 — 사용자 시작 오디오와 개발용 Worklet 신호 / SYS-03·SYS-04 부분 구현

- 변경 파일: `.gitignore`, `package.json`, `package-lock.json`, `src/audio/engine/test-tone-engine.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/components/audio/audio-setup.tsx`, `src/app/page.tsx`, `src/lib/i18n/ko.ts`, `docs/PROGRESS.md`. 이전 Radix UI 변경은 보존함.
- 구현: 사용자 클릭에서만 AudioContext를 생성·재개함. Worklet을 별도 esbuild 엔트리로 빌드해 `/audio/test-tone-processor.js`로 로드하도록 연결함. 출력에 연결된 Worklet은 실제 오디오 블록 길이로 낮은 음량의 440Hz 개발용 신호를 생성하고, 켜기/끄기 명령에 응답함. 종료/시작 취소/비정상 종료 시 node·gain·port·context를 정리함. 마이크 접근과 입력 모니터링은 없음.
- UI: Radix Button/Text로 오디오 시작, 테스트 신호 켜기/끄기, 재개, 종료, 오류·상태, AudioContext의 sampleRate를 표시함. Worklet 준비 전 신호 조작은 노출하지 않음.
- 빌드: `esbuild@0.28.2`를 정확한 버전으로 설치함. `npm run dev`와 `npm run build`가 Worklet을 선행 생성함. Worklet 소스 수정 중에는 별도 `npm run watch:audio`가 필요함. 생성된 `public/audio/*.js`는 Git에서 제외되며 배포 빌드에서 재생성됨.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm install -D esbuild@0.28.2 --save-exact | 성공. npm audit 취약점 0개 |
| npm ci / npm ls --depth=0 | lockfile 기반 469개 패키지 재설치 성공, 직접 의존성 버전 확인. ESLint 지원 종료와 미승인 install script 안내는 남음 |
| npm run build:audio | 성공. 테스트 신호 Worklet JS 1.5 kB 생성 |
| npm run lint | 최초 React 렌더 중 ref 접근 오류 발견. phase 상태를 사용하도록 수정한 뒤 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 최초 Turbopack에서 PostCSS 자식 프로세스의 포트 바인딩 거부로 실패. 권한 상향 재시도도 동일. `next build --webpack` 설정 후 성공, 정적 / 및 /_not-found 생성 |
| npx react-doctor@latest --verbose --scope changed | 오디오 설정 컴포넌트 복잡도 경고를 UI 컨트롤 분리로 해소. 재검사 8개 파일, 100/100, 진단 없음 |
| git diff --check / npm ls esbuild --depth=0 | 공백 오류 없음 / esbuild 0.28.2 확인 |
| npm run test / npm run test:e2e / 브라우저 실청취 | 사용자 요청에 따라 실행하지 않음 |

- 남은 항목: 실제 브라우저의 Worklet URL 로딩, 출력 소리, 취소/재개/정리, 마이크 권한 거부와 장치 없음, MIDI·저장소·격리 모드·입력 설정 진단 미검증 또는 미구현. Phase 0과 SYS-03/04의 인수 기준은 아직 충족하지 않음.
- 다음 작업: 사용자의 테스트 재개 요청 이후 브라우저 검증을 수행하고, 별도 작은 작업으로 마이크 권한·장치 상태와 환경 진단을 구현함.

### 2026-09-21 — 마이크 권한과 입력 장치 설정 / SYS-03·SYS-04·IN-01 부분 구현

- 변경 파일: `src/audio/input/microphone-session.ts`, `src/components/audio/microphone-setup.tsx`, `src/app/page.tsx`, `src/lib/i18n/ko.ts`, `tests/e2e/home.spec.ts`, `docs/PROGRESS.md`.
- 구현: 별도 사용자 클릭에서 `getUserMedia()`로 마이크 권한을 요청함. 음악 입력 처리 옵션을 OFF로 희망 요청하고 실제 적용 여부는 `getSettings()`로 표시함. 권한 거부, 장치 없음, 장치 읽기 실패, 제약 불일치, 요청 중단, 연결 끊김을 구분함. 권한 대기 중 취소와 장치 전환 실패 시 기존 스트림 보존, 늦게 도착한 스트림 정리, 장치 변경·track 종료 감지를 추가함. 스트림은 오디오 출력·녹음·저장에 연결하지 않음.
- UI: Radix Button/Select로 마이크 요청·취소·해제와 허용 후 장치 선택을 제공함. 브라우저 권한 창 자체는 앱에서 닫을 수 없음을 취소 안내에 명시함. footer의 개인정보 문구를 연결 상태와 무관하게 정확한 표현으로 수정하고 기존 E2E 기대 문구도 갱신함.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 성공. / 및 /_not-found 정적 생성 |
| npx react-doctor@latest --verbose | 새 마이크 컴포넌트 복잡도 경고를 화면 구성 분리로 해소. 17개 파일 전체 스캔, 100/100, 진단 없음 |
| npm run test / npm run test:e2e / 브라우저 권한·장치 검증 | 사용자 요청에 따라 실행하지 않음 |

- 남은 항목: 실제 권한 허용·거부·장치 없음·전환·연결 끊김 및 취소 후 스트림 해제는 브라우저에서 확인하지 않음. 채널 선택과 실제 PCM 녹음·모니터링은 아직 구현하지 않음. SYS-03/04와 IN-01의 인수 기준은 완료로 변경하지 않음.
- 다음 작업: Phase 0 환경 진단(MIDI, 저장소, 격리 모드 지원)과 테스트 재개 후 실제 브라우저 검증.

### 2026-09-21 — 읽기 전용 환경 진단 / SYS-04 구현 완료·미검증

- 변경 파일: `src/lib/environment/diagnostics.ts`, `src/components/audio/environment-diagnostics.tsx`, `src/app/page.tsx`, `src/lib/i18n/ko.ts`, `docs/PROGRESS.md`.
- 구현: 명시적인 `환경 확인` 클릭 후 보안 연결, AudioWorklet·마이크·Web MIDI·IndexedDB API 제공 여부, 교차 출처 격리, 저장소 사용량·할당량 추정치와 영구 저장 허용 상태를 표시함. 마이크/MIDI 권한 요청, IndexedDB 열기·쓰기, 영구 저장 요청은 하지 않음. AudioContext sampleRate와 실제 입력 설정은 각각 기존 오디오·마이크 UI에서 해당 기능을 시작한 후 표시함.
- 표시 한계: API가 보여도 실제 장치 연결, Worklet 파일 로딩, IndexedDB 쓰기 성공은 별도 검증이 필요함. 저장소 수치는 브라우저 추정치이며 `persisted()`를 읽을 수 없는 경우에는 확인 불가로 표시함.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | Radix Text의 `as="dt"` 타입 오류 수정 후 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 성공. / 및 /_not-found 정적 생성 |
| npx react-doctor@latest --verbose | 숫자 포맷터 재생성 경고 수정 후 19개 파일 전체 스캔, 100/100, 진단 없음 |
| npm run test / npm run test:e2e / 브라우저 동작 확인 | 사용자 요청에 따라 실행하지 않음 |

- 남은 항목: 지원·미지원 브라우저에서 실제 표시와 저장소 조회 실패 상태를 확인하지 않음. 마이크 장치·오디오 출력·Worklet 로딩도 계속 미검증. Phase 0 완료 판단은 사용자 테스트 재개 후 진행함.
- 다음 작업: 테스트 재개 후 Phase 0 브라우저 검증 및 발견되는 문제 수정. 이후 한 트랙 PCM 녹음과 공통 오디오 시계를 작은 기능 단위로 진행.

### 2026-09-21 — AudioWorklet 공통 시계 / CLK-01 부분 구현

- 변경 파일: `src/audio/transport/audio-frame-clock.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/audio/engine/test-tone-engine.ts`, `src/components/audio/transport-controls.tsx`, `src/components/audio/audio-setup.tsx`, `src/lib/i18n/ko.ts`, `docs/PROGRESS.md`.
- 구현: AudioWorklet의 각 render block에서 실제 출력 배열 길이만큼 위치 프레임을 진행함. 시작·정지·처음으로와 40~240의 정수 BPM 및 3/4·4/4·6/8·7/8 설정을 지원함. BPM 변경 시 현재 음악 tick을 새 템포 앵커로 유지함. Worklet이 보낸 스냅샷만 화면 상태에 반영하고, 재생 중 약 10Hz의 경량 표시 업데이트를 사용함.
- UI: Radix 버튼·숫자 입력·Select로 컨트롤을 제공하고 현재 마디·박, 실제 적용된 BPM·박자표를 표시함. 오디오 Worklet이 준비되기 전에는 조작을 비활성화함. 기존 테스트 신호 켜기/끄기와 트랜스포트 시작/정지는 별개임.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | Worklet 4.5 kB 생성, Next.js production build와 정적 / 및 /_not-found 생성 성공 |
| npx react-doctor@latest --verbose | 21개 파일 전체 스캔, 100/100, 진단 없음 |
| npm run test / npm run test:e2e / 실제 브라우저·실청취 | 사용자 요청에 따라 실행하지 않음 |

- 남은 항목: 현재 시계는 녹음·루프·메트로놈을 구동하지 않음. Tap Tempo, 명령 예약·퀀타이즈, 실제 장치에서의 위치·일시 중지·재개 동작, 장시간 동기화도 미검증. CLK-01 및 Phase 1 완료 기준에는 도달하지 않음.
- 다음 작업: 테스트가 재개되면 Phase 0과 이 시계의 브라우저 동작을 검증. 이후 같은 Worklet 시계에 단일 트랙 PCM 캡처를 연결.

### 2026-09-21 — 오디오 프레임 메트로놈 / CLK-02 부분 구현

- 변경 파일: `src/audio/transport/audio-frame-clock.ts`, `src/audio/metronome/click-voice.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/audio/engine/test-tone-engine.ts`, `src/components/audio/metronome-controls.tsx`, `src/components/audio/audio-setup.tsx`, `src/lib/i18n/ko.ts`, `docs/PROGRESS.md`.
- 구현: 공통 시계의 현재 위치와 절대 beat tick에서 각 클릭 프레임을 계산함. 매번 반올림한 박 길이를 누적하지 않으며 실제 Worklet 처리 블록 안의 해당 프레임에서 강박·약박 클릭을 시작함. 클릭은 테스트 신호와 다른 두 번째 Worklet 출력에서 생성하고 별도 GainNode로 음량을 조절함. 기본 OFF이고 시계가 정지하면 클릭도 짧게 감쇠함.
- UI: Radix Switch와 Slider로 ON/OFF 및 0~100 음량을 제공함. 마이크 권한 없이 사용할 수 있으며 시계가 진행 중일 때만 클릭이 울리도록 구성함. 지금은 마디 첫 박만 강박이며 6/8의 추가 묶음 악센트와 카운트인은 미구현이라고 표시함.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | Worklet 7.3 kB 생성, Next.js production build와 정적 / 및 /_not-found 생성 성공 |
| npx react-doctor@latest --verbose | 23개 파일 전체 스캔, 100/100, 진단 없음 |
| npm run test / npm run test:e2e / 실제 브라우저·실청취 | 사용자 요청에 따라 실행하지 않음 |

- 남은 항목: 실제 장치에서 클릭 소리·음량·시작/정지와 44.1/48kHz 박 경계는 미검증. 클릭을 제외한 PCM 녹음·WAV 내보내기 자체가 아직 없으므로 신호 분리만 구현한 상태. CLK-02 완료 기준에 도달하지 않음.
- 다음 작업: 같은 공통 시계에 연결되는 단일 트랙 PCM 캡처와 첫 반복 전환을 작은 단위로 진행. 테스트 재개 시 Phase 0 및 공통 시계·메트로놈 브라우저 검증을 먼저 수행.

### 2026-09-21 — Stitch 스튜디오 화면 적용 / UX-01·UX-02 부분 구현

- 변경 파일: `src/app/page.tsx`, `src/app/globals.css`, `src/components/ui/studio-theme.tsx`, `src/components/audio/{audio-setup,transport-controls,metronome-controls,microphone-setup,environment-diagnostics}.tsx`, `src/lib/i18n/ko.ts`, `tests/e2e/home.spec.ts`, `docs/PROGRESS.md`. 기존 미커밋 메트로놈 구현을 보존함.
- 디자인 출처: Google Stitch 프로젝트 `projects/6884002784375808500`의 Desktop Studio Console·Mobile Main Studio 시안과 `Studio Loop Console` 디자인 시스템. 어두운 하드웨어 패널, 민트 상태색, 큰 매립형 마디·박 표시, 좁은 화면의 카드 배열을 적용함. Radix Themes 3.3.0은 유지하고 accent를 jade로 변경함.
- 실제 기능 경계: 오디오·시계·메트로놈·마이크·환경 진단은 기존 동작을 유지함. 시안의 다중 트랙·파형·믹서·FX·프로젝트 라이브러리는 아직 구현되지 않았으므로 첫 트랙의 빈 상태와 비활성 녹음·프로젝트 버튼으로 표현함. 시계 설명도 메트로놈 연결 상태에 맞게 수정함.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 첫 실행은 교체 중 남은 CSS 조각의 문법 오류로 실패. 조각 제거 후 Worklet 생성 및 정적 페이지 빌드 성공 |
| npx react-doctor@latest --verbose --scope changed / git diff --check | 변경 파일 14개 스캔, 100/100, 진단 없음 / 공백 오류 없음 |
| npm run test / npm run test:e2e / 브라우저 시각·상호작용 확인 | 사용자 요청에 따라 실행하지 않음. E2E의 jade 테마 기대값과 다중 Card 조회만 변경 |

- 남은 항목: 실제 기기에서 반응형 배치·글자 넘침·포커스·스크린리더·오디오 조작을 확인하지 않음. 시안 전체 기능 구현이나 UX-01/02 완료를 의미하지 않음.
- 다음 작업: 사용자 테스트 재개 요청 시 디자인·오디오 동작을 브라우저에서 확인하고, 이후 단일 트랙 PCM 녹음의 실제 수직 기능을 연결.

### 2026-09-21 — Stitch 원본 구조 재적용 / UX-01·UX-02 보완

- 사용자 지적: 이전 적용은 색상·패널 분위기와 단일 빈 트랙만 반영했고, Stitch 원본의 전체 작업 화면 구조와 달랐음. 이를 동일한 디자인 적용으로 설명한 것은 부정확했음.
- 변경 파일: `src/app/{page.tsx,globals.css}`, `src/components/studio/studio-workspace.tsx`, `src/components/audio/{audio-setup,transport-controls,metronome-controls}.tsx`, `src/lib/i18n/ko.ts`, `tests/e2e/home.spec.ts`, `docs/PROGRESS.md`.
- 구현: Stitch Desktop Studio Console의 헤더·트랜스포트·라이브러리·4×2 트랙 카드·오른쪽 인스펙터·하단 믹서, Mobile Main Studio의 세로 트랙 카드·하단 탐색 구조를 반영함. 기존 AudioWorklet 시계·메트로놈·오디오 시작을 상단 콘솔에, 실제 마이크 설정·환경 진단을 인스펙터에 유지함. Radix Themes 버튼·카드·배지·스위치·슬라이더·입력 컴포넌트를 사용함.
- 기능 경계: 8개 카드와 믹서 레일은 레이아웃 슬롯이며 오디오 데이터나 가짜 파형·가짜 레벨을 표시하지 않음. 트랙 녹음, 오버더빙, 샘플 가져오기, 프로젝트 생성, 믹서·FX·장면은 이유가 연결된 비활성 상태로 둠. 모바일에서는 01~04와 08 빈 슬롯만 노출하고 나머지 뱅크는 준비 중으로 표기함.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | Worklet 생성 및 정적 /·/_not-found 빌드 성공 |
| npx react-doctor@latest --verbose --scope changed / git diff --check | 16개 파일 스캔, 100/100, 진단 없음 / 공백 오류 없음 |
| npm run test / npm run test:e2e / 브라우저 시각 비교 | 사용자 요청에 따라 실행하지 않음. 변경된 화면 제목의 E2E 기대값만 갱신 |

- 남은 항목: 브라우저에서 실제 렌더링과 Stitch 이미지의 시각적 일치, 모바일 넘침·포커스·실제 오디오 동작은 확인하지 않음. 완성형 8트랙 UI는 실제 오디오 기능과 구분해야 함.
- 다음 작업: 사용자 테스트 재개 시 데스크톱·모바일 화면을 실제로 비교해 간격·타입·배치를 조정하고, 오디오 동작을 검증함.

### 2026-09-21 — 스튜디오 가독성과 UI 일관성 / UX-01·UX-02 보완

- 변경 파일: `src/app/{layout.tsx,page.tsx,globals.css}`, `src/app/fonts/PretendardVariable.woff2`, `public/fonts/pretendard-OFL.txt`, `src/components/studio/{studio-workspace,studio-navigation}.tsx`, `src/components/ui/studio-icon.tsx`, `src/components/audio/{audio-setup,transport-controls,metronome-controls,microphone-setup}.tsx`, `src/lib/i18n/ko.ts`, `tests/e2e/home.spec.ts`, `docs/PROGRESS.md`. 이전 미커밋 Stitch 수정 위에 이어 작업함.
- 시각 기준: 기존 27px 조작부와 10px 안팎의 읽기용 텍스트를 정리함. 일반 버튼·입력·메뉴는 최소 44px, 오디오 시작·박자 시작·트랙 주요 버튼은 56px로 맞춤. 한국어·영문 본문은 Pretendard, 박자 숫자만 고정폭으로 표시함. 아이콘은 24×24 뷰박스·동일 선 굵기의 자체 SVG로 통일하고, 패널·버튼·빈 상태의 대비와 여백·모서리 값을 공유함.
- 동선: 오디오 시작을 첫 조작 영역으로 이동하고, 박자·메트로놈을 다음 순서에 배치함. 실제 작업을 수행하지 않는 상단·하단 메뉴와 뱅크 표시를 없애고, 데스크톱·모바일 공통 메뉴를 `#tracks`, `#library`, `#mixer`, `#settings`로 연결함. 앵커 대상은 포커스 가능하며, 좁은 화면에서도 라이브러리·설정·8트랙을 숨기지 않음. 모바일 하단 메뉴는 safe area를 반영하고, 부드러운 이동·상태 전환은 reduced-motion 설정에서 사용하지 않음.
- 폰트 출처: [Pretendard 공식 저장소](https://github.com/orioncactus/pretendard), [v1.3.9](https://github.com/orioncactus/pretendard/releases/tag/v1.3.9). 공식 태그의 `packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`와 LICENSE를 직접 내려받음. 앱 자체에서 폰트를 제공하므로 실행 중 외부 폰트 CDN 요청은 없고, 빌드에도 추가 다운로드가 필요하지 않음. 최초 폰트 다운로드는 약 2MB이며 실제 로딩 체감·전환은 브라우저에서 미검증.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 로컬 가변 폰트 처리, Worklet 생성 및 정적 페이지 빌드 성공 |
| npx react-doctor@latest --verbose --scope changed | 변경 범위 16개 파일, 100/100, 진단 없음 |
| npx react-doctor@latest --verbose | 신규 미추적 컴포넌트를 포함한 전체 26개 파일, 100/100, 진단 없음 |
| git diff --check | 공백 오류 없음 |
| npm run test / npm run test:e2e / 브라우저 시각·상호작용 검사 | 사용자 요청에 따라 미실행. 한국어 세션 제목의 기존 E2E 기대값만 변경 |

- 남은 항목: 코드·정적 검사 결과이며 실제 렌더링의 가독성, 확대·반응형 넘침, 메뉴 포커스 이동, 폰트 로딩, 터치·스크린리더·오디오 동작은 확인하지 않음. 실제 녹음·믹서·이펙트를 구현한 것으로 표시하지 않음. 브랜치 생성·커밋·푸시는 수행하지 않음.
- 다음 작업: 사용자 테스트 재개 요청 시 데스크톱·모바일·확대 화면에서 새 크기·메뉴·폰트와 오디오 조작을 검증.

### 2026-09-21 — 마이크 입력 게인·미터·소리 듣기 / IN-02 부분 구현

- 범위: 단일 트랙 PCM 녹음의 선행 작업인 실제 입력 버스를 연결함. IN-02의 OFF/ON 모니터·게인·미터만 구현하며 AUTO, 채널 선택, 녹음·루핑·저장은 이번 작업에 포함하지 않음.
- 변경 파일: `src/audio/input/{input-meter,microphone-controller,microphone-input-bus,microphone-session}.ts`, `src/audio/engine/test-tone-engine.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/components/audio/{audio-engine-provider.tsx,use-audio-session.ts,audio-setup.tsx,microphone-setup.tsx,microphone-input-controls.tsx}`, `src/app/{page.tsx,globals.css}`, `src/lib/i18n/ko.ts`, `docs/PROGRESS.md`.
- 구조: AudioContext와 마이크 수명을 공통 클라이언트 Provider로 올림. 마이크 요청·취소·전환 상태는 React 외부 컨트롤러에서 관리하고, `useSyncExternalStore`에는 경량 스냅샷만 전달함. 마이크는 계속 명시적인 허용 동작에서만 요청하며 오디오 시작과 분리함. 두 번째 AudioContext를 만들지 않음.
- 신호: 허용된 MediaStream → 모노 합산 GainNode(−24~+24 dB, 기본 0 dB) → 기존 Worklet 입력. 입력 샘플의 피크·RMS를 블록별로 누적하고 약 10Hz로 보내며, 0 dBFS 이상은 사용자가 지울 때까지 표시함. 입력 연결 전에는 측정 대기, 실제 무음은 −∞ dBFS로 구분함. PCM 배열을 UI에 보내거나 보관하지 않으며 타이머 기반 가짜 미터를 사용하지 않음.
- 소리 듣기: Worklet의 세 번째 출력 → 전용 모니터 GainNode → 출력 장치. 기본 OFF, 듣기 음량 기본 20%, 게인/수동 ON·OFF 변경에 10ms 램프를 적용함. 테스트 신호·클릭은 입력 미터에 섞이지 않고 듣기 음량도 입력 게인을 바꾸지 않음. 모니터 복사본만 ±1 sample peak로 제한하며, 이것은 true-peak 리미터나 음량 안전성 보장이 아님. UI에는 헤드폰 사용 안내를 제공함.
- 수명: 장치 변경 요청·연결 끊김·Context 중단·처리 오류 때 모니터를 즉시 OFF로 하고 자동으로 다시 켜지 않음. 오디오 종료·시작 취소·Provider 정리 시 마이크 트랙, 입력 연결, 모니터 버스를 정리함. 경로 revision으로 이전 연결의 늦은 미터 메시지를 무시함. 라우팅 실패 시 원인을 표시하고 입력 재연결 버튼을 제공함.
- 참고: [AudioWorklet process의 가변 블록·입출력 계약](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process), [channelCountMode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/channelCountMode), [MediaStream 입력 연결](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource). 새 패키지 설치나 버전 변경은 없음.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | Worklet 생성 및 정적 /·/_not-found 빌드 성공 |
| npx react-doctor@latest --verbose --scope changed | 변경 범위 19개 파일, 100/100, 진단 없음 |
| npx react-doctor@latest --verbose | 신규 미추적 파일을 포함한 전체 32개 파일, 100/100, 진단 없음 |
| git diff --check | 공백 오류 없음 |
| npm run test / npm run test:e2e / 브라우저·실청취 | 사용자 요청에 따라 미실행 |

- 남은 검증: 정적 검사와 빌드는 통과했지만 실제 마이크의 피크·RMS·클리핑 수치, 출력 경로의 중복·클릭 혼입, 장치 전환·실패·권한 취소·Context suspend/resume, Strict Mode/HMR 정리, 키보드·스크린리더·모바일 화면·실청취는 확인하지 않음. IN-02를 검증 완료로 표시하지 않음.
- 다음 작업: 단일 트랙의 제한된 길이 PCM 버퍼 사전 확보·녹음·취소·공통 시계 기반 첫 반복 연결. 테스트 재개 시 입력 게인 수치·미터·모니터 OFF와 수명 정리를 먼저 검증함.
- Git: 사용자 구현 요청 범위에서 작업 파일만 변경함. 브랜치 생성·커밋·푸시는 수행하지 않음.

### 2026-09-22 — Stitch 원본 비율·콘솔 밀도 복원 / UX-01·UX-02 보완

- 원인: 이전 가독성 수정에서 트랜스포트를 큰 설정 카드 3개로 바꾸고, 4열 트랙을 1650px 이상으로 제한해 일반 데스크톱에서는 원본의 한 화면 콘솔 구조가 사라졌음. 원본의 선·색상·여백보다 일반 대시보드 크기를 우선 적용한 점을 수정함.
- 원본: Google Stitch 프로젝트 `projects/6884002784375808500`의 Desktop `a79d689fdc0e4efdb13e6711061a640d`, Mobile `5df701419d9c42078c1664dd002dd68d` 메타데이터·디자인 시스템을 재조회하고 2560×2048/780×3156 원본 이미지를 열람함. HTML 다운로드는 로그인 페이지로 반환되어 구현 근거로 사용하지 않음.
- 변경 파일: `src/app/{page.tsx,layout.tsx,globals.css}`, `src/components/audio/{audio-setup,transport-controls,metronome-controls}.tsx`, `src/components/studio/{studio-workspace,studio-navigation,studio-input-panel}.tsx`, `src/app/fonts/{GeistVariable,JetBrainsMonoVariable}.ttf`, `public/fonts/{geist,jetbrains-mono}-OFL.txt`, `tests/e2e/home.spec.ts`, `docs/PROGRESS.md`. 기존 미커밋 IN-02 엔진·입력 컨트롤러 작업은 보존함.
- 데스크톱: 64px 한 줄 상단에 워드마크·메뉴·세션·트랜스포트·템포·메트로놈·오디오 상태를 배치함. 1200px부터 라이브러리/4×2 트랙/인스펙터를 나란히 표시하고, 그 아래 믹서를 배치함. 사각 패널 경계·매립형 표시창·그린/오렌지/블루 트랙 색을 원본 값에 맞춤. 세부 오디오·템포·메트로놈 설정은 Radix Popover에 유지함.
- 입력 설정: 기존 실제 마이크 UI를 Radix Dialog로 이동하고 오른쪽에는 장치·실제 게인·모니터 상태와 측정 중일 때의 피크만 표시함. 창을 닫아도 입력 연결이 유지됨을 안내함. 녹음된 데이터가 없으므로 원본의 샘플 파형·재생 중 상태·레벨을 복제하지 않음.
- 모바일: 두 줄 콘솔, Bank 1–4/5–8 전환, 4개 트랙 카드와 믹서 미리보기, 하단 5칸 메뉴를 적용함. 하단은 현재 접근 가능한 Loops/Library/Mixer/FX/Settings로 연결하므로 원본의 Scenes/Drums 라벨과 다름. 트랙 선택은 실제 인스펙터 제목·색을 갱신함. 기능 안내와 개인정보 문구는 접이식 안내에 유지하고 기존 E2E의 해당 안내·모바일 설정 접근 순서만 갱신함.
- 글꼴: [Google Fonts Geist](https://github.com/google/fonts/tree/main/ofl/geist), [Google Fonts JetBrains Mono](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono)의 가변 TTF와 OFL을 내려받아 로컬 제공함. 원본의 Geist·JetBrains Mono를 반영하고 한국어는 기존 Pretendard를 유지함. 패키지 추가·버전 변경 없음.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | next typegen 및 tsc --noEmit 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | Worklet 9.6 kB 생성, 로컬 폰트 처리 및 정적 /·/_not-found 빌드 성공 |
| npx react-doctor@latest --verbose --scope changed | 최초 92/100: AudioPower 복잡도 경고. 상태별 액션 컴포넌트 분리로 해결 |
| npx react-doctor@latest --verbose | 수정 후 신규 파일 포함 전체 33개 파일, 100/100, 진단 없음 |
| 실제 DOM 배치 조회 | 1280×1024에서 헤더 64px·4열 트랙·좌우 패널·믹서 배치, 390px에서 트랙 4개·5칸 메뉴·입력 설정창의 가로 넘침 없음 |
| 구현 화면 캡처 | Ego의 Page.captureScreenshot 시간 초과로 실패. 대체 OS 캡처는 Computer Use 권한이 없어 진행 불가. 픽셀 단위 비교·시각 일치 완료로 표시하지 않음 |
| npm run test / npm run test:e2e / 마이크·오디오·실청취 | 사용자 요청에 따라 미실행. 이번 브라우저 작업은 디자인 배치·설정창 표시 확인에 한정 |

- 남은 항목: 실제 화면 스크린샷과 원본의 나란한 비교, 다양한 화면 크기·확대·폰트 로딩 전환·키보드·스크린리더·오디오 동작은 미검증. 원본과 완전히 같다고 보고하지 않으며 UX-01/02를 검증 완료로 변경하지 않음.
- 다음 작업: 캡처가 가능한 환경에서 원본과 구현 화면의 글자·간격·선 굵기를 확인. 기능 개발을 재개하면 단일 트랙 PCM 녹음으로 진행하고, 테스트는 사용자의 재개 요청을 기다림.
- Git: 브랜치 생성·스테이징·커밋·푸시·머지는 수행하지 않음.

### 2026-09-22 — 사용자 요청에 따른 커밋 전 확인

- 범위: IN-02 입력 게인·미터·모니터링과 이를 연결한 UX-01/02 Stitch 콘솔 수정, 로컬 폰트·라이선스, 기존 E2E 기대 경로와 진행 기록을 함께 반영함.
- Git 작업 요청: 현재 변경 커밋·푸시 및 develop 반영·푸시. 원격 조회 결과 develop과 origin/develop이 동일함을 확인함. 기존 `fix/studio-ui-consistency`를 최신 develop 기준으로 갱신한 뒤 변경을 커밋하고, develop에 머지 커밋으로 반영하는 순서로 진행함.
- 실제 실행: `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build` 모두 성공. `npx react-doctor@latest --verbose --scope changed`는 19개 파일, 100/100, 진단 없음. `git diff --check` 공백 오류 없음.
- 사용자 테스트 중단 요청 유지: 단위·E2E·브라우저·오디오 테스트는 이번 커밋 작업에서 실행하지 않음. 이전 로그의 실제 오디오 동작과 화면 캡처 비교 미검증 제한을 그대로 유지함.

## 알려진 제한과 차단 항목

AudioContext와 개발용 테스트 신호 AudioWorklet, 마이크 권한·장치 흐름, 환경 진단, 공통 시계·메트로놈, 입력 게인·피크/RMS 미터·모니터링의 코드·UI를 추가했지만 실제 Worklet 로딩, 권한 동작, 진단·시계·입력 미터 표시, 실청취는 확인하지 않았다. 기본 화면의 브라우저 DOM 배치는 확인했으나 캡처 비교는 미완료다. 입력은 모노 합산이며 채널 선택, AUTO 모니터링, PCM 녹음, 루핑, 저장, FX, 실제 MIDI 연결, 클라우드 기능은 미구현이다. 화면은 이 상태를 명시하며 새 프로젝트/데모 버튼은 이유와 함께 비활성화한다. 외부 폰트나 오디오 에셋 요청 없이 기본 화면을 렌더한다.

시간 변환 단위 테스트는 실제 오디오 시계의 동작이나 장시간 동기화를 보장하지 않는다. 실제 마이크·헤드폰·인터페이스 청취 및 Chrome/Edge/Firefox/Safari 지원 범위 검증은 남아 있다.

## 다음 Codex 작업

사용자가 구현을 요청하면 AGENTS.md와 현재 진행 상태를 읽는다. 모니터링은 기본 OFF로 유지한다. 테스트 재개 요청 전에는 자동·브라우저 테스트를 실행하지 않는다. 재개되면 production Worklet URL, 실제 오디오 처리, 중복 Context 방지, dispose, 마이크 허용·거부·취소·장치 전환, 입력 게인·실제 피크/RMS·클리핑 표시·모니터 OFF/ON·독립 음량·종료 시 트랙 해제, 환경 진단의 지원·미지원·조회 실패 표시, 공통 시계의 시작·정지·템포 변경·재개와 메트로놈의 강약박·음량을 검증한 뒤 Phase 0 완료 여부를 판단한다. 이후 Phase 1의 한 트랙 PCM 녹음과 공통 시계 연결을 작은 단위로 진행한다.
