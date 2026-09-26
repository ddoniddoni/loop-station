# 개발 진행 기록

## 현재 상태

- 기준일: 2026-09-27
- 프로젝트 상태: **프로젝트 기본 구성 완료. Phase 0/1은 부분 구현·미검증. Phase 2는 공통 시계의 8트랙 녹음·반복·오버더빙·Undo/Redo·프로젝트 저장·트랙 볼륨/팬/Mute/Solo·루프 마스터·출력 미터·1/2/4/8마디 선택까지 부분 구현·미검증.**
- 프로젝트 위치: `/Users/ddoni/dev/loop-station`, 현재 브랜치 `fix/studio-navigation` (최신 원격 develop `e569efc` 기준). Tap Tempo에 이어 `feature/phase-2-recording-length`의 `97f7eff`를 통합함. 파일 백업과 Git stash에 이전 미커밋 작업 원본도 보관함.
- UI 기반: Radix Themes 3.3.0과 Stitch 콘솔 배치를 유지함. 01–08 모든 트랙에 1/2/4/8마디 선택 녹음·반복·오버더빙·Undo/Redo·비우기·복구를 연결함. 모바일 Bank 1–4/5–8와 선택 트랙 상세 정보 지원. LOCAL에서 프로젝트 저장 상태와 재시도 제공. 트랙별 볼륨·팬·Mute·Solo, 루프 마스터 볼륨·음소거, 트랙/마스터 출력 미터·피크 홀드·과부하 경고, 믹서 Bank 전환과 v5 프로젝트 저장/복구를 연결함. FX는 미구현.
- 검증: 이전 Radix 작업의 단위 테스트 21개와 Chromium E2E 2개 통과 기록은 아래 로그 참조. 이후 사용자 요청에 따라 테스트 실행을 중단함. PCM 녹음 테스트 9개, 오버더빙·이력·명령 처리 테스트 21개, 저장 관련 단위 테스트 10개, 다중 트랙 단위 테스트 12개와 저장 E2E 시나리오 3개는 작성만 했음. 실제 녹음·Worklet·권한·장치·실청취·IndexedDB 저장/복구는 미검증.
- 이전 믹서 검증: 앞선 단위 11개·E2E 2개에 스테레오/미터 관련 단위 8개와 실제 Worklet 좌우 출력 E2E 1개를 추가 작성했으며 모두 미실행. 린트·타입 검사·빌드·React Doctor 실제 결과는 2026-09-26 로그 참조.
- 이전 디자인 작업의 확인: 당시 요청 범위에서 원본 이미지 열람과 실제 DOM의 데스크톱·모바일 배치 치수, 설정창 표시만 확인함. 캡처 도구 시간 초과로 구현 화면의 스크린샷 비교는 미완료이며, 오디오·마이크 기능을 시작하지 않음.
- 이번 길이 선택 검증: PCM·오버더빙·컨트롤러·저장 단위 사례와 10분 혼합 길이 DSP 시나리오, 실제 녹음·복구 E2E를 작성했으며 미실행. 린트·타입 검사·빌드·React Doctor 결과는 아래 로그 참조.
- 이번 Phase 0 보강: Worklet 첫 처리 응답과 15초 시작 제한, 초기화/종료 Promise 공유, 취소·오류 정리·재시작의 작업 번호 확인, 종료 실패 재시도 구현. 단위 11개와 production 오디오 E2E 4개를 작성했으며 미실행. 정적 검사와 빌드 결과는 아래 로그 참조.
- 이번 Phase 1: Tap Tempo로 4분음표 입력 간격의 BPM 제안·설정 적용, 40~240 BPM 범위·최근 네 간격 평균·빠른 입력 제외·긴 중단 후 재시작·상태 초기화·기존 템포 잠금을 구현함. 단위 18개와 production E2E 시나리오 4개는 작성만 했으며 미실행. 정적 검사 결과는 아래 로그 참조.
- 별도 구현: 1마디 카운트인은 `feature/phase-1-count-in` / `f7195e0`에 구현·푸시되어 있으며 develop에는 아직 통합하지 않음. 카운트인 단위 26개·E2E 2개도 미실행이며 해당 브랜치의 기록을 따름.
- 다음 작업: 사용자 피드백에 따른 여러 로컬 프로젝트 관리. 키보드·입력 채널·AUTO·음성 보정·재생 예약은 각 기능 브랜치에 구현·미통합이며 `plan/NEXT.md`의 브랜치 목록을 따른다. 테스트 재개 요청 후 Phase 0 오디오 수명·production Worklet·마이크 권한/장치 해제부터 확인하고 Tap Tempo·PCM·믹서·저장 및 별도 카운트인 브랜치를 검증함.
- 상세 명세: `LOOP_STATION_SPEC.md`
- 개발 기준: [Phase별 로드맵](plan/README.md)과 [다음 작업 계획](plan/NEXT.md). 이후 기능 선택과 작업 범위는 이 계획을 기준으로 진행한다.

이 문서의 표는 완료 보고용 장식이 아니라 실제 구현 추적용이다. 가짜 입력으로 검증한 항목은 그 범위를 밝히고, 실제 마이크/브라우저/클라우드에서 미검증한 항목은 따로 남긴다.

## 2026-09-27 — 내 프로젝트 페이지·보기 메뉴·마이크 연결 동선 수정

- 요구사항: `UX-01`, `UX-02`, `UX-03`, `SYS-02`, `IN-01`의 부분 구현. 사용자가 Project/View의 앵커 이동과 찾기 어려운 마이크 연결을 지적하여 다음 오디오 기능보다 우선했다.
- 원인: 상단 Project/Track/View는 각각 `#project`/`#tracks`/`#mixer` 링크였다. 실제 페이지/보기 메뉴가 없고 프로젝트·데모 버튼과 라이브러리 탭은 기능이 없었다.
- 변경: `/projects` 페이지에 현재 로컬 프로젝트 1개의 실제 저장 상태·트랙 수·템포·저장 날짜/시간·작업 이어하기를 제공한다. 로딩/빈 상태/불러오기 실패/저장 실패/충돌/세션 전용 상태를 구분한다. 저장소 실패를 빈 목록으로 표시하지 않으며 재시도 경로를 연결한다.
- View는 Radix 라디오 메뉴로 전체/트랙/믹서/입력·트랙 설정을 전환한다. 화면 패널은 CSS로 전환하며 오디오 컨트롤러 수명과 분리한다. 모바일 상단에서도 내 프로젝트·View·마이크 연결을 사용할 수 있다.
- 상단 마이크 연결과 기존 입력 설정은 하나의 Dialog를 공유한다. 오디오 시작/재개/취소/종료 재시도와 기존 마이크 권한·장치 선택·입력 설정을 모으고 첫 녹음까지 안내한다. 사용자 동작 없이 마이크를 요청하거나 모니터링을 켜지 않는다.
- 공통 RootLayout으로 AudioEngineProvider와 헤더를 이동하여 Next Link 페이지 왕복 시 프로젝트 PCM·저장 상태·오디오 연결을 유지한다. 정지/PANIC은 두 화면 모두 제공한다. 브라우저 새로고침은 기존 복구 경로와 수동 오디오 시작을 따른다.
- 동작 없는 Edit, 라이브러리 탐색 탭과 아래쪽 프로젝트 자리표시자 영역을 제거한다. FX/배속은 사유와 함께 기존 비활성 상태를 유지한다.
- 변경 파일: `src/app/{layout,page,globals.css}`, `src/app/projects/page.tsx`, `src/components/studio/{studio-shell,studio-view-provider,studio-navigation,studio-workspace,studio-input-panel,microphone-connection,my-projects}.tsx`, `src/audio/storage/loop-persistence.ts`(저장 시각 레이블에 날짜 추가), `tests/e2e/{home,local-save,tap-tempo,navigation}.spec.ts`, `docs/plan/NEXT.md`와 이 문서.
- 작성한 회귀 시나리오: 내 프로젝트 직접 진입/새로고침/뒤로가기·빈 상태, 모바일 View/마이크 Dialog/포커스, 저장 접근 거부 시 오류 표시, 실제 합성 마이크 PCM 저장 후 페이지 왕복/새로고침 복구 4개. 기존 홈·저장·Tap UI 선택자를 변경된 메뉴 이름에 맞췄다. **모두 실행하지 않았다.**
- 검증: 린트·타입 검사·production 빌드 성공. 빌드에 `/`와 `/projects` 정적 경로가 포함됨. React Doctor 변경 범위 100점 확인 후 전체 검사에서 새 파일의 복잡도·렌더 중 날짜 포맷·context 값 경고를 발견해 수정함. 최종 전체 검사 79개 파일 및 스테이징 후 변경 범위 72개 파일 모두 100/100점, 경고 0개. 마지막 일반 실행은 npm DNS 조회 실패(ENOTFOUND), 오프라인 대체는 캐시 없음(ENOTCACHED)으로 실패했으며 네트워크 권한으로 재실행하여 성공했다. `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` 모두 exit 0.
- 제한: 실제 브라우저 레이아웃·키보드·모바일·오디오·IndexedDB 왕복은 미검증. 사용자 중단 요청에 따라 `npm run test`, `test:audio`, `test:e2e`, 브라우저 자동 조작, 실청취를 실행하지 않았다. Phase 전체와 실제 동작의 검증 완료로 표시하지 않는다.
- 저장 범위: 현재 자동 저장 프로젝트는 1개다. 여러 프로젝트 생성/이름 변경/복제/삭제, 파일 백업, 샘플 가져오기, 데모는 미구현이며 페이지에 명시한다. 저장 스키마/PCM/DSP/Worklet 프로토콜은 변경하지 않았다.
- Git: 최신 develop에서 `fix/studio-navigation`을 생성했다. 기존 기능 브랜치와 stash/worktree는 보존했다. 특히 재생 예약 `9a53514`는 별도 브랜치에 있으며 이 브랜치에는 미통합이다. develop 병합은 별도 요청 범위다.

## 상태 규칙

`미착수`, `진행 중`, `부분 구현`, `구현 완료/미검증`, `검증 완료`, `조건부 비활성`, `차단됨`을 구분한다. 구현을 시작하지 않았는데 검증 완료로 변경하지 않는다. 조건부 비활성은 미구현 기능을 숨기는 용도로 쓰지 않는다. 환경/설정 근거와 남은 검증을 기록한다.

## 단계 진행

| Phase | 목표 | 상태 | 증거/다음 작업 |
|---|---|---|---|
| 0 | 저장소와 실제 오디오 기반 | 부분 구현 | SYS-01 검증. 사용자 시작/종료, 테스트 신호 Worklet, 마이크 권한·장치 UI와 환경 진단 구현. 첫 처리 응답·무응답 감지·취소/종료/재시작 보강. 실제 브라우저 검증은 남음 |
| 1 | 한 트랙 녹음과 공통 시계 | 부분 구현 | 같은 Worklet 시계의 1/2/4/8마디 PCM 캡처·자동 반복·정지/재시작과 Tap Tempo 제안·설정 적용 구현. 카운트인은 별도 기능 브랜치에 구현·미통합. 채널 선택, AUTO 모니터링·다른 퀀타이즈 설정, 실제 검증은 남음 |
| 2 | 8트랙, 오버더빙, 로컬 저장 | 부분 구현 | 8트랙의 공통 시계 반복·오버더빙·1단계 Undo/Redo·프로젝트 자동 저장과 v1 이전 구현. 트랙 볼륨·팬·Mute·Solo, 루프 마스터·미터와 v5 저장 구현. 1/2/4/8마디 선택 연결, 실제 검증은 남음 |
| 3 | 편집, 지연 보정, 파일 입출력 | 미착수 | 기본 루핑 제품 완성 목표 |
| 4 | FX, 장면, 내부 녹음 | 미착수 | 라우팅/공연 녹음 검증 |
| 5 | MIDI, 리듬, 자동화, 곡 구성 | 미착수 | 내부 악기와 컨트롤러 기능 |
| 6 | 고급 DSP와 고급 루프 | 미착수 | 변환 음질/성능 게이트 |
| 7 | 선택적 Supabase 클라우드 | 미착수 | 사용자 활성화 및 환경 필요 |
| 8 | 출시 검증 | 미착수 | 지원 범위와 실제 측정값 확정 |

## 요구사항 추적

관련 기준은 상세 명세 3절을 확인한다. 테스트와 증거에는 파일 경로, 테스트명, 실행일, 실제 장치/브라우저 조건을 기록한다.

아래 표는 Tap Tempo와 녹음 길이 선택·v5 저장을 포함한 코드 기준이다. 카운트인은 별도 브랜치에 구현·미통합 상태이며 해당 기록을 함께 확인한다.

| ID | 기능 | 주 Phase | 상태 | 실제 검증/남은 항목 |
|---|---|---:|---|---|
| SYS-01 | 프로젝트 기반 | 0 | 검증 완료 | App Router, React, TS strict, npm lockfile, lint/typecheck/test/build 및 production E2E 통과 |
| SYS-02 | 로컬 우선 실행 | 2 | 부분 구현 | 계정/환경변수 없이 8트랙 프로젝트 저장·복구. 저장 실패 시 이전 저장본 보존과 메모리 전용 모드 제공. 프로젝트 목록·오프라인 캐시·실제 검증은 남음 |
| SYS-03 | 안전한 오디오 시작 | 0 | 부분 구현 | AudioContext/Worklet과 마이크 요청을 분리. 첫 처리 응답 확인·준비 시간 제한·취소/재시작 겹침 방지·종료 실패 재시도와 권한 거부·장치 없음·연결 끊김 안내 구현. 단위/production E2E 작성, 실제 브라우저 검증은 남음 |
| SYS-04 | 환경 진단 | 0 | 구현 완료/미검증 | AudioContext sampleRate와 마이크 `getSettings()`의 채널·처리 설정 표시. 버튼을 누르면 AudioWorklet·마이크·MIDI·IndexedDB API, 보안 연결·격리 모드, 저장소 사용량/할당량 추정과 영구 저장 허용 상태를 읽음. API 존재와 실제 동작은 구분하며 브라우저 검증은 남음 |
| IN-01 | 입력 장치와 채널 선택 | 1 | 부분 구현 | 장치 목록·전환과 모노 녹음 라우팅 구현. 녹음 준비·대기·캡처 중 장치 변경 차단. 채널 선택과 실제 장치 검증은 남음 |
| IN-02 | 입력 게인과 모니터링 | 1 | 부분 구현 | 모노 입력 버스, −24~+24 dB 게인, Worklet PCM 피크/RMS·클리핑 유지 표시, 기본 OFF 모니터와 독립 음량 구현. 장치 전환·오디오 중단 때 모니터 OFF. 실제 입력 처리 설정 표시는 기존 기능 유지. AUTO·음성 보정 옵션 변경·실청취·브라우저 검증은 남음 |
| IN-03 | 녹음 지연 보정 | 3 | 미착수 | — |
| CLK-01 | 공통 트랜스포트 | 1 | 부분 구현 | 동일 Worklet에서 40~240 BPM·3/4·4/4·6/8·7/8 시계와 녹음·반복을 연결. Tap Tempo의 4분음표 간격 평균·BPM 제안과 기존 설정 적용 경로 연결. 루프·복구 이력·녹음 준비·편집·저장소 잠금 유지. 실제 동작 검증은 남음 |
| CLK-02 | 메트로놈 | 1 | 부분 구현 | Worklet 오디오 프레임에서 절대 beat tick의 경계를 계산해 마디 첫 박 강박·나머지 약박을 별도 출력으로 생성. ON/OFF·0~100 음량 제공. 6/8 세부 악센트 묶음, 카운트인 전용/항상 모드, 실제 실청취·WAV 제외 검증은 남음 |
| CLK-03 | 퀀타이즈와 고정 길이 | 1 | 부분 구현 | 실제 블록 길이 두 개 이상 여유가 있는 다음 마디에서 시작, 선택한 1/2/4/8마디 후 첫 반복. 재시작도 다음 마디, 정지·취소는 다음 처리 시점. 다른 그리드·카운트인과 실제 경계 검증은 남음 |
| CLK-04 | 첫 루프로 템포 설정 | 2 | 미착수 | — |
| CLK-05 | 장시간 동기화 | 2 | 부분 구현 | 혼합 1/2/4/8마디를 절대 tick 경계에서 반복. 8kHz·127 BPM·7/8의 10분 DSP 시뮬레이션 작성만 했으며 드리프트·실제 장시간 실행 미검증 |
| CLK-06 | 템포 변경 정책 | 6 | 미착수 | — |
| LOOP-01 | 다중 트랙 | 2 | 부분 구현 | 8개 모노·1/2/4/8마디 트랙, 공통 AudioFrameClock, 트랙별 녹음/반복/편집과 모바일 두 Bank 연결. 동시 캡처는 1개로 제한. 트랙 믹서 연결. 장시간/브라우저/장치 검증은 남음 |
| LOOP-02 | 녹음과 오버더빙 | 2 | 부분 구현 | 8트랙 각각 모노 float32 PCM 녹음→반복과 한 바퀴 오버더빙 구현. 다른 트랙 재생은 유지하며 동시 편집 차단. 입력 중단/취소 시 기존 루프 유지. 연속 여러 바퀴·실제 검증은 남음 |
| LOOP-03 | Undo, Redo, Clear | 2 | 부분 구현 | 직전 오버더빙 1회 Undo/Redo를 재생 경계에서 적용, 예약 취소 지원. 비우기 복구 시 편집 이력도 복원. 다단계 이력·전체 비우기·실제 검증은 남음 |
| LOOP-04 | Replace와 Feedback | 4 | 미착수 | — |
| LOOP-05 | 재생과 정지 모드 | 3 | 미착수 | — |
| LOOP-06 | 리버스와 배속 | 3 | 미착수 | — |
| LOOP-07 | 루프 길이 배수 편집 | 3 | 미착수 | — |
| LOOP-08 | 파형 편집 | 3 | 미착수 | — |
| LOOP-09 | 소리 감지 녹음 | 4 | 미착수 | — |
| LOOP-10 | 최근 연주 가져오기 | 4 | 미착수 | — |
| LOOP-11 | 내부 바운스와 리샘플링 | 4 | 미착수 | — |
| LOOP-12 | 동기/자유 루프 | 3 | 부분 구현 | 1/2/4/8마디 선택·박자 동기 반복·길이에 맞는 오버더빙/Undo/저장 연결. 자유 길이·독립 재생과 실제 검증은 남음 |
| LOOP-13 | 인트로와 테일 | 6 | 미착수 | — |
| PERF-01 | 클립과 장면 | 4 | 미착수 | — |
| PERF-02 | 그룹과 상호 배타 재생 | 4 | 미착수 | — |
| PERF-03 | Follow Action과 곡 순서 | 5 | 미착수 | — |
| PERF-04 | 자동화 | 5 | 미착수 | — |
| PERF-05 | 사용자 지정 연주 화면 | 5 | 미착수 | — |
| PERF-06 | 세트리스트 | 5 | 미착수 | — |
| PERF-07 | 공연 모드와 비상 정지 | 3 | 미착수 | — |
| MIX-01 | 트랙 믹서 | 2 | 부분 구현 | −60~+6 dB 트랙/루프 마스터 볼륨·팬·Mute·복수 Solo, 10ms 램프·PCM 피크/RMS·홀드·과부하 경고와 v5 저장/복구 구현. 입력 모니터를 포함한 프로그램 버스 통합과 실제 검증은 남음 |
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
| FILE-02 | 로컬 자동 저장 | 2 | 부분 구현 | 8트랙 PCM·각 루프 길이·공통 박자·각 이력·믹서 설정을 하나의 트랜잭션으로 저장. 새로고침 복구·저장 상태·재시도 제공. 프로젝트 목록·녹음 journal·실제 브라우저 검증은 남음 |
| FILE-03 | 프로젝트 아카이브 | 3 | 미착수 | — |
| FILE-04 | 믹스와 스템 WAV | 3 | 미착수 | — |
| FILE-05 | 전체 공연 녹음 | 4 | 미착수 | — |
| FILE-06 | 복구와 버전 관리 | 3 | 부분 구현 | schemaVersion 5와 v1/v2/v3/v4 읽기 이전, PCM/메타데이터/트랙 순서/팬·마스터 설정 SHA-256·메모리 검사, 루프와 Undo/Redo 길이 일치 검사, 원자적 revision 비교·다른 탭 안내. journal·충돌 버전 별도 보관·실제 검증은 남음 |
| CLOUD-01 | 선택적 계정과 프로젝트 | 7 | 미착수 | — |
| CLOUD-02 | 사용자 데이터 보안 | 7 | 미착수 | — |
| CLOUD-03 | 재시도 가능한 동기화 | 7 | 미착수 | — |
| CLOUD-04 | 읽기 전용 링크 공유 | 7 | 미착수 | — |
| UX-01 | 통합 작업 화면 | 4 | 부분 구현 | Stitch 콘솔과 8트랙 녹음·진행률·상태·길이, 볼륨·팬·Mute·Solo, 루프 마스터·실제 PCM 미터 연결. FX는 미구현. 이번 기능의 브라우저 배치·상호작용과 이전 화면 스크린샷 비교는 미완료 |
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

### 2026-09-22 — 단일 트랙 4마디 PCM 녹음·첫 반복 / CLK-03·LOOP-02·LOOP-03 부분 구현

- 범위: 01 Beat 트랙만 모노 입력을 4마디 녹음하고 자동 반복함. 시작·재시작은 다음 마디, 정지·취소는 다음 처리 시점. 오버더빙이나 나머지 트랙을 구현 완료로 표시하지 않음.
- 변경 파일: `src/audio/loop/{loop-protocol,pcm-loop,loop-controller}.ts`, `src/audio/{engine/test-tone-engine,input/microphone-controller,worklets/test-tone-processor}.ts`, `src/components/audio/{audio-engine-provider,use-audio-session,audio-setup,transport-controls,microphone-setup}.tsx`, `src/components/studio/{recording-track,studio-workspace}.tsx`, `src/app/{page.tsx,globals.css}`, `src/lib/i18n/ko.ts`, `tests/audio/pcm-loop.test.ts`, `tests/e2e/home.spec.ts`, `README.md`, `docs/PROGRESS.md`.
- 캡처: 메인 스레드에서 재생·보관용 float32 버퍼 두 개를 사전 할당해 Worklet으로 transfer함. 실제 게인 적용 후 입력만 두 버퍼에 기록하며 클릭·테스트 톤·루프 출력을 녹음 입력에 연결하지 않음. 녹음 마지막 샘플 다음 프레임에 첫 반복을 시작함. 실제 무음과 입력 채널 없음/비정상 샘플을 구분함.
- 시계: 기존 AudioFrameClock의 절대 tick→frame 변환으로 다음 마디를 계산하고 실제 render block 두 개 이상의 여유를 둠. 각 반복 경계도 절대 tick에서 다시 계산하고 소스 PCM을 선형 보간하여 반복 길이 반올림 오차를 누적하지 않음. UI 타이머를 녹음/재생 시계로 사용하지 않음.
- 데이터: 완성 시 미리 함께 채운 보관 버퍼만 메인 컨트롤러로 transfer하고 Worklet 재생 버퍼는 detach하지 않음. PCM은 React/JSON 상태에 넣지 않으며 UI에는 메타데이터·프레임 진행률만 약 10Hz로 전달함. 복구용 사본은 실시간 process 밖에서 만듦. 새 패키지·Worker·SAB·IndexedDB 도입 없음.
- 한도: 최대 60초와 32MiB 작업 예산 안에서 사전 할당함. 현재 4마디·40~240 BPM·지원 박자표에서는 3~24초 범위이며 실제 sampleRate, 새 버퍼 4개분과 이전 복구 버퍼 2개분의 보수적인 교체 여유를 포함해 계산함. `navigator.storage.estimate()`로 최소 두 PCM 사본의 저장 여유도 확인함. API/조회 미지원이면 경고하고 메모리 전용으로 계속하며 실제 저장이 된 것으로 표시하지 않음.
- 복구: 확정된 루프는 AudioContext 종료 후에도 현재 탭에 보관하고 같은 sampleRate로 재시작하면 복구함. 샘플레이트가 다르거나 복구 사본 확보 실패 시 원본을 유지하고 재생을 차단함. 비우기는 다음 정상 녹음 완료 전까지 1단계 복구 가능하며, 새 녹음 중 입력이 끊겨도 이전 복구본은 덮어쓰지 않음.
- 중단: 입력 연결 소실·정지로 중단된 캡처는 유효한 부분 PCM과 `incomplete` 메타데이터를 보관하고 정상 루프로 재생하지 않음. 직접 녹음 취소는 미확정 take를 버림. 오디오 종료/Panic·processor 오류로 컨텍스트가 닫히면 아직 수신하지 못한 미확정 데이터는 취소하며 완전한 복구를 보장하지 않음. Context suspend 시 메시지 수신이 재개 때까지 늦어질 수 있음.
- UI: 첫 트랙의 실제 녹음·취소·재생·정지·비우기·복구 버튼과 상태/길이/진행률을 연결함. 재시작 예약은 QUEUED로 표시함. 입력 장치 변경은 녹음 준비·대기·캡처 중 막고, BPM·박자표는 녹음 또는 루프가 있을 때 고정함. 새로고침/닫기 전 미저장 데이터 경고를 등록하되 브라우저의 강제 종료 복구를 보장하지 않음. 미구현 믹서 대신 루프 출력 게인은 현재 0.5 고정임.
- 참고: [AudioWorklet 처리 블록과 입력/출력 계약](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process), [MessagePort transfer](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/postMessage), [저장 용량 추정](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate).

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | 신규 테스트 메시지의 unknown 좁히기 오류 수정 후 성공 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | Worklet 번들 및 정적 /·/_not-found 빌드 성공 |
| npx react-doctor@latest --verbose --scope changed | 최초 92/100: TransportControls 복잡도 경고. 설정 폼을 분리해 해결 |
| npx react-doctor@latest --verbose | 신규 파일 포함 전체 38개 파일, 100/100, 진단 없음 |
| git diff --check | 공백 오류 없음 |
| npm run test / npm run test:e2e / test:audio / 브라우저·실청취 | 사용자 요청에 따라 실행하지 않음. 새 DSP 코어 테스트 9개 작성과 기존 E2E 개인정보 문구 변경만 수행 |

- 작성한 테스트: 44.1/48kHz의 정확한 PCM frame 수·첫/끝 샘플·첫 반복, 가변 처리 블록, 정상 무음, 127 BPM·7/8의 절대 경계 반복, 취소, 입력 없음에 따른 부분 보관, 중단 명령과 take ID, 버퍼 부족 거절, 명령 중복 제거와 복구. 합성 입력을 실제 PcmLoop에 전달하도록 작성했지만 **실행하지 않아 통과 여부는 미확인**임.
- 남은 항목: 실제 Worklet 녹음·첫 반복·재시작·권한/장치 끊김·Context suspend/resume·브라우저 저장 공간 실패·메모리 한도·출력 음량·실청취·모바일 배치/포커스는 미검증. 별도 2~10ms 경계 크로스페이드·지연 보정·부분 녹음의 재생/내보내기·오버더빙·IndexedDB 자동 저장은 미구현. Phase 1과 요구사항을 검증 완료로 변경하지 않음.
- 다음 작업: 사용자 테스트 재개 요청 시 위 코어·Worklet 경계와 실제 장치 동작부터 검증. 기능 구현을 계속하면 한 트랙의 오버더빙과 원본 복구를 연결함.
- Git: 구현 파일만 변경했고 브랜치 생성·스테이징·커밋·푸시는 실행하지 않음.

### 2026-09-22 — 한 바퀴 오버더빙·Undo/Redo / LOOP-02·LOOP-03 부분 구현

- 범위: 01 Beat에서 다음 루프 경계부터 한 바퀴 덧녹음하고 자동 확정함. 오버더빙 한 번이 Undo 단위이며 직전 1회만 보장함. 다른 트랙과 연속 여러 바퀴 세션은 추가하지 않음.
- 변경 파일: `src/audio/loop/{loop-protocol,pcm-loop,loop-controller,loop-history}.ts`, `src/audio/worklets/test-tone-processor.ts`의 입력 주석, `src/components/studio/recording-track.tsx`, `src/app/globals.css`, `src/lib/i18n/ko.ts`, `tests/audio/{overdub,loop-history,loop-controller}.test.ts`, `README.md`, `docs/PROGRESS.md`. 이전 PCM 녹음 작업의 미커밋 파일을 보존함.
- DSP: 현재 재생 PCM은 수정하지 않고 사전 할당한 작업·보관 버퍼에 `float32(기존 샘플 + 게인 적용 입력)`을 기록함. Feedback은 1 고정. 녹음 중 출력은 기존 샘플이고 현재 입력은 기존 모니터 경로에서만 들림. 마지막 샘플 처리 후 새 PCM으로 교체하고 별도 보관 버퍼만 transfer함. process 안에서 큰 버퍼 할당/복사나 비동기 작업을 하지 않음.
- 경계: 실제 처리 블록 2개 이상 여유가 있는 다음 루프 tick을 예약함. 각 순환은 절대 tick→frame으로 계산하며 소수 프레임 길이의 오버더빙도 해당 순환의 실제 frame 수를 기록함. 입력 누락·NaN/Infinity·float32 누적 범위 초과·불연속 프레임·정지·취소는 작업 버퍼를 버리고 기존 PCM을 유지함.
- 이력: `LoopHistory`가 현재/Undo/Redo/비우기 복구 PCM을 React 밖에서 소유함. 확정된 새 오버더빙만 Redo를 없앰. 비우기 복구는 편집 이력도 함께 복원함. 재생 중 Undo/Redo는 루프 경계, 정지 상태에서는 즉시 적용하며 정지 명령이 대기 중인 이력을 확정하면 이를 컨트롤러에 알림.
- 명령 처리: 메인에서 이력을 먼저 바꾸지 않고 Worklet 적용 응답 이후 확정함. 예약 취소·녹음 취소 요청 직전에 오디오 스레드가 이미 완료한 경우에도 원래 명령 ID로 결과를 수신함. 비동기 저장 용량 조회 중 도착하는 이전 상태 메시지가 준비 상태와 마이크 잠금을 해제하지 않도록 처리함.
- 메모리: 32MiB 작업 예산에서 현재 PCM·Undo/Redo·비우기 복구 버퍼와 사전 할당·교체 여유를 함께 계산함. 이력을 임의로 버리며 새 녹음을 시작하지 않으며 예산 초과 시 기존 루프/복구 단계를 유지하고 이유를 표시함. 낮은 BPM·높은 샘플레이트에서는 추가 오버더빙이 거절될 수 있음.
- UI: 기존 Stitch 카드 안에 Radix 오버더빙·Undo·Redo·예약 취소를 추가함. 대기/캡처/재생 상태와 취소 시 기존 루프 유지 안내를 표시함. 한 바퀴 단위·1단계 이력·세션 메모리 전용이라는 범위를 안내하고 미구현 기능 문구를 갱신함.

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | 성공, 신규 테스트 파일 포함 타입 검사 |
| npm run build | 성공, Worklet 27.4kB 번들 및 /·/_not-found 정적 빌드 |
| npx react-doctor@latest --verbose --scope changed | 26개 파일, 100/100, 진단 없음 |
| npx react-doctor@latest --verbose | 신규 파일 포함 전체 42개 파일, 100/100, 진단 없음 |
| git diff --check | 공백 오류 없음 |
| npm run test / npm run test:e2e / test:audio / 브라우저·실청취 | 사용자 요청에 따라 실행하지 않음 |

- 작성한 테스트: 실제 PcmLoop에 합성 A/B 입력과 가변 블록·transfer를 전달하는 A+B/기존 PCM 불변/출력 중복 방지/반복 중 감쇠 없음, 취소·입력 소실·비정상 입력·정지 롤백, Undo/Redo 경계·예약 취소·늦은 취소·소수 길이 반복. 별도 이력 테스트와 브라우저 의존성을 대역으로 바꾼 컨트롤러 테스트에 준비 중 상태 경합·취소 응답 순서·메모리 거절을 작성함. 세 파일의 21개 사례 모두 **미실행이며 통과를 주장하지 않음**.
- 남은 항목: 실제 브라우저·AudioWorklet·청취·모바일 배치·포커스·장시간 반복은 미검증. 경계 크로스페이드·지연 보정·Feedback 조절·Replace·다단계 이력·로컬 저장은 미구현. 출력 게인은 기존 0.5 고정이며 오버더빙 누적에 따른 출력 클리핑을 제어하는 트랙 믹서/최종 리미터는 없음. AudioContext 종료 전에 수신되지 않은 미확정 작업은 취소하고 마지막 수신된 루프를 유지함.
- 다음 작업: 확정 PCM의 IndexedDB 로컬 저장을 작은 단위로 진행. 사용자가 테스트 재개를 요청하면 작성한 코어 테스트와 실제 Worklet 동작부터 검증함.
- Git: 브랜치 생성·스테이징·커밋·푸시·머지를 실행하지 않음.

### 2026-09-22 — PCM 녹음·오버더빙 커밋 전 확인

- 사용자 요청: Git Flow에 따른 커밋·푸시. `git fetch origin` 후 `develop`과 `origin/develop`의 차이가 0/0임을 확인하고 `feature/pcm-loop-overdub` 브랜치를 생성함.
- 커밋 범위: 01 트랙 PCM 녹음·반복·오버더빙·Undo/Redo, 연결 UI, 관련 테스트 코드와 진행 문서. 생성된 Worklet 번들 및 로컬 환경 파일은 포함하지 않음.
- 실제 실행: `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공. `npx react-doctor@latest --verbose --scope changed` 100/100, 진단 없음. `git diff --check` 공백 오류 없음.
- 사용자 테스트 중단 요청 유지: 단위·E2E·오디오·브라우저·실청취 테스트는 실행하지 않음. 이전 로그의 기능 미검증 상태를 유지함.

### 2026-09-22 — develop 통합 확인

- 사용자 요청: `feature/pcm-loop-overdub`의 `c6b6308`을 `develop`에 머지하고 푸시. 원격 최신 상태를 가져온 뒤 두 로컬 브랜치가 각각 원격과 일치함을 확인함.
- LOOP-02·LOOP-03 관련 24개 파일이 충돌 없이 병합되었고, 이 확인 기록을 추가하기 전 병합 결과가 기능 브랜치와 동일함을 확인함. 제품 코드의 추가 변경 없음.
- 실제 실행: `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공. `npx react-doctor@latest --verbose --scope changed` 35개 파일, 100/100. `git diff --cached --check` 공백 오류 없음.
- 단위·E2E·오디오·브라우저·실청취 테스트는 사용자 중단 요청에 따라 미실행. 기능 검증 상태와 다음 로컬 저장 작업은 그대로 유지함.

### 2026-09-23 — 01 트랙 로컬 자동 저장·새로고침 복구 / SYS-02·FILE-02·FILE-06 부분 구현

- 범위: 한 브라우저 origin의 01 트랙 한 세션. 녹음/오버더빙 확정, 오디오 스레드가 적용한 Undo/Redo, 비우기/복구 시 PCM과 현재 편집 이력을 자동 저장함. 중단 후 컨트롤러가 수신한 부분 녹음도 incomplete 상태로 보관하되 자동 반복하지 않음. 루프의 sampleRate·BPM·박자·길이도 함께 복구함.
- 변경 파일: `src/audio/storage/{loop-session,indexed-db-loop-repository,loop-persistence}.ts`, `src/audio/loop/{loop-history,loop-controller}.ts`, `src/components/studio/{loop-save-status.tsx,loop-save-label.ts,recording-track.tsx}`, `src/components/audio/{audio-engine-provider,audio-setup,transport-controls}.tsx`, `src/app/{page.tsx,globals.css}`, `src/lib/i18n/ko.ts`, `tests/audio/{loop-storage,loop-controller}.test.ts`, `tests/e2e/{local-save,home}.spec.ts`, `README.md`, `docs/PROGRESS.md`.
- 저장 설계: 새 의존성 없이 단일 세션용 IndexedDB 래퍼를 추가함. DB `loop-station-local` 버전 1의 `heads`와 `sessions`에 현재 리비전 UUID와 제한된 PCM 스냅샷을 보관함. PCM은 JSON/React에 넣지 않고 ArrayBuffer로 보관함. 현재/Undo/Redo/비우기 복구 버퍼를 유지하되 32MiB 예산에서 저장/해시 사본과 재생 버퍼 여유를 검사함. 전체 프로젝트 정규화·청크 에셋 저장 구조는 추후 확장 항목임.
- 원자성: 쓰기 트랜잭션 전에 형식·음악적 길이·메모리·유한 샘플을 검사하고 PCM과 메타데이터 SHA-256을 준비함. 하나의 readwrite 트랜잭션에서 현재 리비전을 비교하고 PCM·리비전을 함께 교체함. put 요청 성공만으로 저장 완료를 표시하지 않고 transaction complete 이후 확정함. quota/중간 실패/충돌은 이전 저장본을 유지함.
- 복구: 클라이언트 effect에서 저장소를 초기화하며 SSR/모듈 최상위에서 브라우저 API를 실행하지 않음. 불러오기가 끝날 때까지 편집을 잠그고, 무결성·미래 schemaVersion 오류는 저장본을 덮어쓰지 않고 안내함. 복구 PCM은 메타데이터만 UI에 노출하고 정지 상태로 유지함. 오디오 시작 시 기존 Worklet 복구 경로에 연결하며, 다른 sampleRate로 시작하면 기존 안내대로 변환 재생을 차단함.
- 저장 상태: 상단 Radix Popover에 불러오는 중/저장 중/저장 완료/불러오기 실패/저장 실패/충돌/메모리 전용을 구분함. 저장 중에는 추가 편집·녹음을 잠깐 막아 버퍼 중첩을 제한하며 이미 재생 중인 오디오는 계속됨. 실패 후 재시도 또는 `저장 없이 계속`을 제공함. 읽기 실패 후 메모리 전용을 선택해도 기존 디스크 데이터를 덮어쓰지 않음. 미확정 녹음·미저장 변경·충돌에는 기존 beforeunload 경고를 유지함.
- 다중 탭: BroadcastChannel이 있으면 다른 저장을 감지해 편집을 중지하고 안내함. 메시지 지원 여부와 무관하게 실제 쓰기 트랜잭션의 revision 비교가 오래된 저장의 덮어쓰기를 막음. 충돌한 새 연주는 해당 탭 메모리에 유지함. 독점 편집 임대권과 충돌 버전의 별도 영구 보관은 아직 구현하지 않음.
- UI: 원본 Stitch 콘솔 배치 안에서 기존 미저장 문구를 실제 저장 상태 버튼으로 교체하고, 오디오를 시작하기 전에도 복구된 루프의 BPM·박자를 표시함. 기본 입력 모니터 OFF·사용자 동작 기반 마이크/오디오 시작 정책은 유지함. 빈 트랙의 별도 템포 변경·입력 장치/게인 설정·프로젝트 목록은 이번 저장 범위에 포함하지 않음.
- 작성한 테스트: 저장 코덱 왕복/PCM·메타데이터 손상/미래 버전/길이/비정상 샘플, 초기 로딩 잠금/중복 초기화, 쓰기 확정 전 상태, 실패 후 동일 base 재시도, 읽기 실패 후 메모리 전용의 덮어쓰기 방지, 충돌, AudioContext 이전 복구의 단위 테스트 10개. 저장 상태 흐름의 repository는 대역이며 IndexedDB 자체 검증을 대신하지 않음. 별도 Chromium E2E 2개는 합성 마이크 실제 녹음→저장→새로고침 후 PCM 해시/메타데이터 비교와 PCM put 이후 head put 실패 주입에 따른 트랜잭션 롤백/이전 루프 복구를 작성함. 모두 미실행이며 통과 여부를 주장하지 않음.
- 참고: [IndexedDB 기본 흐름과 트랜잭션](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [트랜잭션 완료 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

| 실행 명령/검사 | 실제 결과 |
|---|---|
| npm run lint | 성공, 경고 0개 |
| npm run typecheck | 성공, 신규 단위/E2E 코드 포함 타입 검사 |
| NEXT_TELEMETRY_DISABLED=1 npm run build | 성공, Worklet 27.4kB 및 /·/_not-found 정적 빌드 |
| npx react-doctor@latest --verbose --scope changed | 100/100. 신규 미추적 파일 범위 확인을 위해 전체 진단 추가 실행 |
| npx react-doctor@latest --verbose | 최초 78/100의 4개 경고 확인 후 준비/트랜잭션 분리, 예산 내 중복 없는 병렬 해시, 라벨 모듈 분리, 저장 시각 포맷의 상태 갱신 시점 이동. 최종 전체 49개 파일 100/100, 진단 없음 |
| git diff --check | 공백 오류 없음 |
| npm run test / npm run test:e2e / test:audio / 브라우저·실청취 | 사용자 요청에 따라 미실행 |

- 남은 검증/제한: 실제 IndexedDB 저장·복구·quota/blocked/versionchange·다중 탭 경합·브라우저별 권한·장치·청취·모바일 Popover는 미검증. 저장소 정리·비공개 모드 종료·브라우저 강제 종료에 대한 영구 보관은 보장하지 않음. 진행 중 녹음 청크 journal, 프로젝트별 저장, migration, 파일 백업, 다른 sampleRate 변환, navigator.storage.persist 요청 UI는 미구현. SYS-02/FILE-02/FILE-06을 검증 완료로 올리지 않음.
- 다음 작업: 다중 트랙을 작은 수직 단위로 추가하고 저장 모델을 확장. 사용자 테스트 재개 시 신규 코어/저장 테스트와 실제 IndexedDB E2E부터 검증함.
- Git: 현재 develop 작업 트리에서 파일만 수정함. 브랜치 생성·스테이징·커밋·푸시·머지를 실행하지 않음.

### 2026-09-23 — 공통 시계의 8트랙 루핑 / LOOP-01·LOOP-02·LOOP-03·FILE-02·FILE-06 부분 구현

- 범위: 기존 01 트랙 엔진을 8개 독립 PCM 트랙으로 확장함. 같은 AudioFrameClock을 한 번만 진행시키며 트랙별 다음 마디 녹음/재생, 4마디 반복, 한 바퀴 오버더빙, Undo/Redo, 비우기/복구를 연결함. 전체 transport 시작/정지는 모든 트랙에 적용됨. 입력은 한 트랙만 녹음하고 다른 트랙의 반복 재생은 유지함.
- 변경 파일: `src/audio/loop/{station-protocol,pcm-station,station-controller,loop-controller,pcm-loop}.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/audio/engine/test-tone-engine.ts`, `src/audio/storage/{station-session,loop-session,loop-persistence,indexed-db-loop-repository}.ts`, `src/components/audio/{audio-engine-provider,audio-setup}.tsx`, `src/components/audio/use-audio-session.ts`, `src/components/studio/{recording-track,studio-workspace,loop-save-status}.tsx`, `src/components/studio/track-availability.ts`, `src/app/{page.tsx,globals.css}`, `src/lib/i18n/ko.ts`, `tests/audio/{pcm-station,station-controller,station-storage}.test.ts`, `tests/e2e/local-save.spec.ts`, `README.md`, `docs/PROGRESS.md`.
- 명령/소유권: Worklet 메시지에 trackId를 붙여 sequence·캡처 확인·이력 확인을 해당 트랙에만 전달함. 비동기 용량 확인부터 편집 완료까지 다른 트랙의 녹음/편집을 잠금. 마이크 장치 잠금은 프로젝트가 합산함. 전체 저장 중에도 추가 편집을 차단하며 기존 오디오 루프는 계속됨. 프로젝트 공통 상태와 각 트랙 진행 상태를 분리해 PCM을 React에 넣지 않음.
- 메모리/출력: 트랙당 기존 32MiB, 프로젝트 전체 128MiB의 보수적인 작업 예산을 적용함. 모든 트랙의 현재/이전/비우기 이력, Worklet 사본, 녹음 버퍼와 저장/해시 사본을 고려하고 IndexedDB 전체 프로젝트 교체에 필요한 공간을 확인함. 8트랙 합산 출력은 −1~1로 제한한 뒤 기존 0.5 게인을 사용함. 캡처/오버더빙 PCM에는 출력 제한을 적용하지 않음. 이는 고정 출력 보호이며 트랙 믹서/음질 검증된 마스터 리미터는 미구현임.
- 저장/이전: schemaVersion 2로 8개 트랙과 각 이력을 같은 IndexedDB 트랜잭션에 보관함. 기존 DB 버전/키를 유지하여 v1 데이터 읽기 후 01 트랙에 배치함. 읽기만으로 기존 저장본을 수정하지 않고, 다음 확정 변경의 CAS 트랜잭션에서 v2로 교체함. v1 무결성/미래 버전/공통 박자 불일치 실패 시 원본 보존. v2 체크섬은 트랙 순서까지 포함함. 다른 탭 충돌과 저장 실패의 이전 저장본 보존 정책을 유지함.
- UI: 기존 Stitch/Radix 카드·톤·모바일 Bank를 유지하고 02–08 자리표시자를 실제 녹음 카드로 연결함. 선택한 트랙의 메타데이터, 트랙별 고유 접근성 ID와 다른 트랙 작업 대기 이유를 표시함. 08 전용 자리표시자 CSS를 제거함. 저장 상태는 프로젝트 전체를 가리킴.
- 제한: 8개 모노·4마디 고정, 한 번에 한 트랙 녹음/편집. 루프 또는 비우기 복구 이력이 있으면 BPM/박자를 고정함. 샘플레이트 불일치 시 다른 빈 트랙 녹음도 차단하여 원본을 보존함. 오래된 v1에 서로 다른 박자의 현재/복구 이력이 함께 있으면 로드를 차단하며 자동 수리는 미구현. 프로젝트 목록/이름/새 프로젝트, 믹서, 길이 선택, 장면과 파일 입출력은 다음 범위임.
- 작성한 테스트: 새 단위 12개 — 공통 경계 합산/트랙별 정지, 다른 트랙 반복 중 실제 PCM 캡처, 동시 캡처 거절, 합산 출력 제한/다른 BPM 거절, v1 이전/8트랙 이력 왕복/트랙 순서·PCM 손상/형식 거절, 비동기 준비 잠금·취소/잘못된 트랙 응답/원자 저장 대기/샘플레이트 불일치. 저장 E2E를 v2에 맞추고 2트랙 녹음·새로고침 PCM 비교 시나리오 1개 추가함. **모두 작성만 했으며 실행하지 않음.**
- 검사 중 수정: React Doctor의 UI 분기 복잡도 경고 2건은 작업 가능 상태 계산과 진행 표시 컴포넌트를 분리하여 정리함. 생성 Worklet 린트의 미사용 예산 상수 경고는 상수를 정적 리터럴로 표현해 번들러가 오디오 스레드에서 제거하도록 수정함. 규칙 무시나 테스트 삭제는 하지 않음.
- 최종 실제 검사: `npm run lint` 성공(생성 Worklet 포함 경고 0개), `npm run typecheck` 성공(신규 단위/E2E 코드 포함), `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 30.1kB, `/`·`/_not-found` 정적 빌드), `npx react-doctor@latest --verbose --scope changed` 100/100, `npx react-doctor@latest --verbose` 전체 57개 파일 100/100, `git diff --check` 공백 오류 없음.
- 미실행: `npm run test`, `npm run test:audio`, `npm run test:e2e`, 브라우저·실청취는 사용자 중단 요청에 따라 실행하지 않음. 인수 기준을 검증 완료로 올리지 않음.
- 다음 작업: 트랙별 볼륨·Mute·Solo 믹서. 테스트 재개 시 다중 트랙 PCM/저장 테스트, 실제 Worklet과 브라우저 v1 이전·실패 롤백·장시간 반복·청취부터 확인함.
- Git: 기존 로컬 저장 작업을 보존하고 develop 작업 트리의 파일만 수정함. 브랜치 생성·스테이징·커밋·푸시·머지를 실행하지 않음.

### 2026-09-23 — 8트랙 프로젝트 커밋·통합 전 확인

- 사용자 요청: 현재까지 커밋·푸시하고 develop에 머지 후 푸시. `git fetch origin` 후 develop과 origin/develop의 차이가 0/0임을 확인하고 기존 변경을 보존한 `feature/multitrack-local-project` 브랜치를 생성함.
- 커밋 범위: 8트랙 PCM 루핑, 트랙별 편집 이력, IndexedDB 프로젝트 저장·v1 이전, 연결 UI·테스트 코드·문서. 생성 Worklet 번들·환경 파일·진단 산출물은 포함하지 않음.
- 실제 실행: `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공. `npx react-doctor@latest --verbose` 전체 57개 파일 100/100, 진단 없음. `git diff --check` 공백 오류 없음.
- 사용자 테스트 중단 요청 유지: 단위·E2E·오디오·브라우저·실청취 테스트는 실행하지 않음. 기존 부분 구현·미검증 상태를 유지함.

### 2026-09-26 — 트랙 볼륨·Mute·Solo / MIX-01·FILE-02·FILE-06 부분 구현

- 범위: 8트랙의 −60~+6 dB 볼륨(기본 0 dB), Mute, 복수 Solo를 실제 PCM 합산 경로에 연결함. Solo가 하나라도 있으면 선택된 트랙만 믹스에 포함하며 Mute가 우선함. 음소거해도 루프 재생 위치와 캡처 처리는 계속 진행하고, 녹음/오버더빙 원본 PCM과 이력은 변경하지 않음.
- 변경 파일: `src/audio/loop/{track-mixer,pcm-station,station-controller}.ts`, `src/audio/storage/station-session.ts`, `src/components/studio/{mixer-console,studio-workspace,loop-save-status}.tsx`, `src/app/globals.css`, `src/lib/i18n/ko.ts`, `tests/audio/{pcm-station,station-controller,station-storage}.test.ts`, `tests/e2e/{local-save,mixer}.spec.ts`, `README.md`, `docs/PROGRESS.md`.
- DSP: 사전 할당한 고정 크기 게인/목표/증분/잔여 프레임 배열로 10ms 선형 램프를 처리함. 변경 도중 다른 값으로 움직이면 현재 게인에서 새 목표로 램프를 다시 계산함. 오디오 프레임으로 진행하며 샘플 처리 중 배열 생성·타이머·저장·Promise를 추가하지 않음. 기존 합산 출력 −1~1 제한과 마스터 게인 0.5를 유지함. 음질 검증된 리미터로 표시하지 않음.
- 명령: 모든 트랙 설정을 한 메시지로 보내고 안전한 정수 sequence로 오래된 명령/응답을 제외함. Worklet이 게인 목표를 적용한 응답을 받은 후 저장하며, 대기 중에는 `오디오 적용 대기`를 표시함. 오디오를 켜기 전에는 설정만 저장하고 새 Worklet 연결 시 다시 전달함. 마이크·입력 모니터·테스트 신호·메트로놈 경로는 이 트랙 믹서의 대상이 아님.
- 저장: schemaVersion 3의 `history: { tracks, mixer }`에 PCM·트랙 이력·믹서 설정을 같은 트랜잭션으로 저장함. 체크섬에 믹서 값을 포함하고 유한 수·범위·8트랙 배열을 검사함. v1/v2 원본 체크섬과 형식을 검증한 후 기본 0 dB/Mute OFF/Solo OFF로 메모리에서 이전함. 읽기만으로 디스크를 변경하지 않고 다음 저장 시 기존 revision의 CAS로 교체함. 손상/미래 버전/저장 실패/다중 탭 충돌의 기존 원본 보존 경로를 유지함.
- 저장 빈도: 페이더 드래그 중에는 경량 설정만 엔진에 보내고, 포인터 조작 종료·키보드 값 확정·포커스 이탈에서 전체 프로젝트를 저장함. 값 변경마다 큰 PCM 저장 사본을 만들지 않음. 저장 전 변경은 dirty로 표시하고 기존 beforeunload 보호에 포함함. 저장 중 및 트랙 녹음/편집 중에는 믹서 조작을 잠그고 이유를 안내함. 재생 중 믹싱은 지원함.
- UI: 기존 믹서 배치의 장식 페이더/M/S를 Radix Slider/Button으로 교체함. dB 값, 눌림 상태, 음소거/솔로 제외 이유와 키보드 포커스를 표시함. 모바일 Mixer 화면에 Bank 1–4/5–8 전환을 추가하고 숨겨진 Bank의 Solo도 상단에 표시함. 팬·마스터·미터는 미구현으로 안내함.
- 코드 검토 중 보완: 설치된 Radix Slider의 키보드 `onValueCommit`이 `onValueChange`보다 먼저 호출되는 경로를 확인함. 확정 콜백의 값을 컨트롤러에 먼저 전달하고 저장하도록 처리함. 관련 E2E는 작성만 했으며 브라우저 재현/검증은 미실행임.
- 작성한 테스트: 신규 단위 11개 — PCM 합산 게인/10ms 전환/복수 Solo·Mute 우선순위, 음소거 중 위상 진행·원본 캡처 보존, 비정상/오래된 명령, 최신 응답 이후 1회 저장, 오디오 시작 전 복구·재연결, 저장 실패 재시도·조작 잠금, v2 읽기 이전, 믹서 설정 왕복·변조/범위 거절. 기존 저장 테스트와 E2E의 v3 구조를 갱신함. 신규 E2E 2개는 방향키 음량·설정 저장/새로고침·실제 Worklet 응답과 모바일 Bank/Solo 표시를 다룸. **모두 미실행이며 통과를 주장하지 않음.**
- 실제 검사: `npm run lint` 성공(경고 0개), `npm run typecheck` 성공. `npx react-doctor@latest --verbose --scope changed` 100/100, 전체 `npx react-doctor@latest --verbose` 신규 파일 포함 60개 파일 100/100, 진단 없음. `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 32.5kB, `/`·`/_not-found` 정적 빌드). `git diff --check` 공백 오류 없음.
- 미실행/제한: 이전 사용자 테스트 중단 요청을 유지하여 `npm run test`, `npm run test:audio`, `npm run test:e2e`, 브라우저·실청취를 실행하지 않음. 음량 램프의 청취 품질, 실제 Worklet 출력, IndexedDB v1/v2→v3 이전/실패 롤백/다중 탭, 터치·키보드·모바일 배치는 미검증임. 팬·마스터 조절·레벨 미터·피크 홀드·클리핑 경고·안전 리미터는 미구현이므로 MIX-01 전체를 완료로 올리지 않음.
- 다음 작업: 팬·마스터 볼륨·실제 출력 레벨 미터. 테스트 재개 요청 시 믹서/저장 단위 테스트와 `mixer.spec.ts`·`local-save.spec.ts` 및 실제 출력/원본 PCM 불변/실청취부터 검증함.
- Git: develop 작업 트리에 구현만 반영함. 브랜치 생성·스테이징·커밋·푸시·머지를 실행하지 않음.

### 2026-09-26 — 팬·루프 마스터·PCM 출력 미터 / MIX-01·FILE-02·FILE-06 부분 구현

- 범위: 모노 8트랙의 −1~1 팬, −60~+6 dB 루프 마스터 볼륨·음소거, 트랙/마스터 L/R 피크·RMS·피크 홀드·과부하 경고와 초기화를 연결함. 마스터는 루프 8트랙만 제어하고 마이크 모니터·메트로놈·테스트 신호는 포함하지 않으며 화면에 범위를 명시함. 입력 모니터를 포함하는 전체 Program Bus는 MIX-02 후속 작업임.
- 변경 파일: `src/audio/loop/{track-mixer,pcm-station,station-controller,output-meter}.ts`, `src/audio/engine/test-tone-engine.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/audio/storage/station-session.ts`, `src/components/studio/{mixer-console,mixer-master,output-level-meter,loop-save-status}.tsx`, `src/app/globals.css`, `src/lib/i18n/ko.ts`, `tests/audio/{pcm-station,output-meter,station-controller,station-storage}.test.ts`, `tests/e2e/{mixer,stereo-output}.spec.ts`, `README.md`, `docs/PROGRESS.md`.
- 스테레오/게인: Worklet 출력 3을 2채널로 만들고 트랙당 좌우 게인을 10ms 램프로 적용함. 정전력 팬을 중앙 L/R=1로 정규화하여 기존 중앙 배치 음량을 유지함. 끝 방향 계수는 √2(약 +3 dB), 반대쪽은 정확히 0임. 마스터 기본값은 기존 게인 0.5에 해당하는 −6.020599913279624 dB. 외부 GainNode는 1이며 게인을 이중 적용하지 않음. 원본 PCM·녹음 이력은 변경하지 않음.
- 출력 제한: 기존 합산 선행 클리핑을 제거하고 마스터 게인 뒤에서 각 채널을 ±1로 제한함. 따라서 마스터를 내리면 합산 과부하를 줄일 수 있음. 종전 선행 클리핑에 걸렸던 큰 믹스는 같은 설정에서도 더 크게 출력될 수 있음. 이는 최종 하드 클리핑이며 lookahead/true-peak/음질 보장 리미터가 아님.
- 미터: 실제 처리 PCM에서 트랙별 좌우 최대 피크·스테레오 RMS와 마스터 각 채널의 최종 float32 샘플 레벨을 계산함. 트랙 0 dBFS 도달/초과 및 마스터 출력 상한 도달/초과를 경고하고 피크 홀드/경고는 수동 초기화까지 유지함. 캡처 PCM 배열을 UI에 보내지 않으며 고정 누산기를 약 10Hz로 게시함. 정지 상태에도 무음 수치를 갱신하고 Context 중단/종료에는 측정 대기로 초기화함. 초기화 revision·믹서 sequence로 이전 메시지를 무시함.
- UI/상태: 미터 전용 external store로 값 갱신을 프로젝트 설정·PCM 저장 구독과 분리함. 팬은 Radix 슬라이더와 L/R·중앙 문구, 마스터는 볼륨·BUS MUTE·좌우 미터를 사용함. 모바일에서도 마스터를 표시하며 데스크톱 고정 높이를 해제해 확장한 믹서가 트랙 영역과 겹치지 않도록 함. 실제 화면 배치 검증은 미실행임. 기존 녹음/편집/저장 중 조작 잠금과 조작 종료 시 저장 규칙은 유지함.
- 저장: schemaVersion 4에 트랙 `pan`과 프로젝트 `master`를 포함하고 체크섬으로 검증함. v1/v2는 기본 믹서, v3는 기존 볼륨/Mute/Solo를 보존하면서 중앙 팬·마스터 0.5를 추가해 읽기 이전함. 원본 revision·PCM을 유지하고 열기만으로 저장본을 바꾸지 않음. 미터 수치와 경고는 저장하지 않음.
- 작성한 검증: 신규 단위 8개 — 좌우 팬/램프/중앙 음량, 마스터 선행 감쇠·출력 제한/미터/뮤트, transport 정지 중 무음 갱신, 피크·RMS·홀드·초기화, v3 읽기 이전, v4 팬/마스터 왕복·변조 거부, 설정 일괄 저장·범위 거부, 미터 구독 분리·초기화 후 늦은 메시지·종료 처리. 기존 UI E2E에 팬/마스터 저장·복구와 미터 측정을 추가함. 신규 E2E 1개는 합성 PCM을 실제 Worklet 출력 3 → 독립 스테레오 측정 Worklet으로 전달해 좌우 분리와 마스터 음소거를 확인하는 시나리오임. **모두 작성만 했으며 미실행.**
- 정적 검사 중 수정: React Doctor의 트랙 컴포넌트 분기 복잡도 경고를 팬 컴포넌트 분리로 정리함. 번들러가 사용하지 않는 마스터 기본 dB의 Math 초기화식을 남겨 생성 JS 린트에 경고가 생긴 원인을 확인하고 동일 값의 상수로 바꾸어 미사용 코드 제거가 가능하게 함. 규칙 무시·검증 제외는 추가하지 않음.
- 실제 검증: `npm run lint` 성공(재생성한 Worklet 포함 경고 0개), `npm run typecheck` 성공, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 36.3kB, `/`·`/_not-found` 정적 빌드). `npx react-doctor@latest --verbose` 전체 65개 파일 100/100, `npx react-doctor@latest --verbose --scope changed` 100/100, 진단 없음. `git diff --check` 공백 오류 없음. 단위·E2E·브라우저·실청취는 이전 사용자 테스트 중단 요청에 따라 실행하지 않음.
- 남은 항목: 실제 스테레오 장치 청취·모노 장치 다운믹스·클리핑 음질·Worklet 출력·미터 정확도·IndexedDB v1/v2/v3→v4 이전·모바일/접근성·장시간 부하 미검증. 입력 모니터 포함 Program Bus, 음질 검증된 안전 리미터, 녹음 중 믹서 조절은 미구현. MIX-01을 검증 완료로 올리지 않음.
- 다음 작업: 1/2/4/8마디 녹음 길이 선택. 테스트 재개 시 스테레오 PCM/미터/저장 테스트 및 실제 Worklet 좌우 출력 E2E부터 검증함.
- Git: 이전 믹서 변경을 보존하고 develop 작업 트리에 이어서 구현함. 브랜치 생성·스테이징·커밋·푸시·머지는 실행하지 않음.

### 2026-09-26 — 스테레오 트랙 믹서 커밋·통합 전 확인

- 사용자 요청: 여기까지 커밋·푸시하고 develop에 머지한 뒤 푸시. `git fetch origin` 후 `develop`과 `origin/develop`이 0/0으로 일치함을 확인하고 `feature/stereo-track-mixer`에서 커밋을 준비함.
- 범위: MIX-01·FILE-02·FILE-06 관련 트랙 볼륨/Mute/Solo·팬, 루프 마스터, 실제 PCM 출력 미터, v4 설정 저장·이전, UI와 테스트 코드 및 문서. 위 두 구현 로그의 23개 변경 파일만 포함하며 생성 Worklet·로컬 환경 파일은 제외함.
- 실제 실행: `npm run lint` 성공(경고 0개), `npm run typecheck` 성공, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 36.3kB, `/`·`/_not-found` 정적 빌드). `npx react-doctor@latest --verbose --scope changed` 50개 파일 100/100, 진단 없음. `git diff --check` 공백 오류 없음.
- 사용자 테스트 중단 요청 유지: 단위·오디오·E2E·브라우저·실청취는 실행하지 않음. 기능 및 인수 기준의 미검증 상태와 위 제한을 유지함.

### 2026-09-26 — 1/2/4/8마디 녹음 길이 / CLK-03·CLK-05·LOOP-12·FILE-02·FILE-06 부분 구현

- 범위: 8개 트랙의 빈 상태에서 1/2/4/8마디를 개별 선택함. 기본은 4마디. 기존 다음 마디 시작 예약을 유지하고 선택한 길이의 실제 PCM 캡처가 끝나면 다음 오디오 프레임부터 반복함. 자유 길이·기존 루프 자르기/늘리기·카운트인은 이번 범위에 포함하지 않음.
- 변경 파일: `src/audio/loop/{loop-protocol,loop-controller,pcm-loop}.ts`, `src/audio/storage/{loop-session,station-session}.ts`, `src/components/studio/{recording-length,recording-track,studio-workspace}.tsx`, `src/app/globals.css`, `src/lib/i18n/ko.ts`, `tests/audio/{pcm-loop,overdub,loop-controller,station-controller,station-storage,mixed-loop-lengths}.test.ts`, `tests/e2e/local-save.spec.ts`, `README.md`, `docs/PROGRESS.md`.
- 시계/버퍼: 허용 길이를 메인 컨트롤러와 Worklet 명령 경계에서 검사함. 준비를 시작할 때 길이를 고정하고 녹음 명령에 함께 전달함. 모든 시작/종료·반복 경계는 기존 공통 AudioFrameClock의 절대 tick→frame 변환을 사용함. 루프 메타데이터의 ticks가 확정 길이이며 오버더빙도 현재 루프의 박자·ticks로 버퍼를 사전 할당함. process 안의 새 대형 할당이나 타이머는 없음.
- 한도/복구: 선택 길이에 맞춰 트랙 32MiB·프로젝트 128MiB와 저장 여유를 검사함. 긴 녹음이나 보관 이력으로 예산을 초과하면 전송/캡처 전에 거절하고 기존 소리·복구 이력을 유지함. 다른 길이를 고른 뒤 비운 루프를 복구하면 실제 원래 길이와 Undo/Redo를 다시 표시함. Undo/Redo의 ticks가 현재 루프와 다른 저장 데이터는 거절함.
- UI: Radix Select에 트랙별 접근 가능한 이름·레이블·잠금 사유를 연결함. 녹음 준비/대기/진행·편집·저장 중과 기존 루프가 있을 때 선택을 잠금. 녹음 버튼·진행 안내·클립 상세에 선택/실제 길이를 표시하고 모바일에서는 선택→녹음 버튼 순서로 배치함. 선택만으로 AudioContext나 마이크를 켜지 않음. 빈 트랙의 다음 녹음 선택은 탭 메모리에만 유지하며 미저장 PCM으로 표시하지 않음.
- 저장: schemaVersion 5에서 1/2/4/8마디의 ticks·PCM 용량을 허용하며 체크섬에 기존처럼 포함함. v1/v2/v3/v4는 원래 버전의 체크섬을 먼저 확인하고 PCM·revision·믹서 설정을 보존해 읽기 이전함. 열기만으로 저장소를 다시 쓰지 않고 다음 변경에서 v5로 저장함. 형상은 v4와 같지만 허용 루프 길이가 확장되므로 구버전 앱이 미래 형식으로 구분하도록 버전을 올림.
- 작성한 검증: 신규 단위 17개 — 1/2/4/8마디·44.1kHz·127 BPM·7/8의 마지막 캡처/첫 반복 프레임, 비정상 길이·버퍼 거절, 1/2/8마디·48kHz 오버더빙과 Undo, 비동기 준비 중 선택 고정/취소, 길이별 버퍼·Clear 복구, 8마디 메모리 거절 시 복구본 보존, 트랙별 독립 선택/잠금, 혼합 길이·부분 녹음·이력 저장 왕복, v4 읽기 이전/변조 거절, 잘못된 길이/용량/Undo 거절, 8kHz·127 BPM·7/8 혼합 길이의 10분 DSP 시나리오. 신규 E2E 1개는 합성 마이크로 1마디/8마디 녹음, 기존 트랙 재생 유지, 오버더빙, Clear→다른 길이 선택→원본 복구와 새로고침을 다룸. **모두 작성만 했고 미실행.**
- 실제 검사: `npm run typecheck` 성공. `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 37.1kB, `/`·`/_not-found` 정적 빌드). `npm run lint` 성공(생성 Worklet 포함, 경고 0개). `npx react-doctor@latest --verbose --scope changed` 58개 파일 100/100, 전체 `npx react-doctor@latest --verbose` 신규 파일 포함 67개 파일 100/100, 진단 없음. `git diff --check` 공백 오류 없음.
- 미실행/제한: 기존 사용자 테스트 중단 요청에 따라 `npm run test`, `npm run test:audio`, `npm run test:e2e`, 브라우저·실청취를 실행하지 않음. 실제 Worklet의 길이별 경계·혼합 길이 장시간 반복·선택 UI/키보드/터치·IndexedDB v1~v4→v5와 저장 실패/복구·장치 청취는 미검증임. 10분 테스트 작성은 장시간 동기화 통과 증거가 아니며 Phase와 인수 기준을 검증 완료로 변경하지 않음.
- 다음 작업: 녹음 전 1마디 카운트인 ON/OFF. 테스트 재개 시 길이별 PCM·혼합 길이 DSP·오버더빙·이력·저장 단위와 `local-save.spec.ts`를 우선 실행함.
- Git: develop 작업 트리에 구현함. 이번 요청에서는 브랜치 생성·스테이징·커밋·푸시·머지를 실행하지 않음.

### 2026-09-26 — 개발 계획 폴더와 작업 기준 정리

- 사용자 요청: 소개한 Phase별 계획을 전용 폴더에 보관하고 이후 개발을 그 계획에 따라 진행. 관련 추적: QA-04의 계획/구현/검증 구분, 다음 작업 CLK-02·CLK-03. 기능의 인수 기준 상태는 변경하지 않음.
- 변경 파일: `docs/plan/README.md`, `docs/plan/NEXT.md`, `AGENTS.md`, `README.md`, `docs/LOOP_STATION_SPEC.md`, `docs/PROGRESS.md`.
- 내용: Phase 0~8의 목표·범위·통과 기준과 기본 제품/고급 기능/선택 클라우드/출시 구분을 정리함. 다음 1마디 카운트인 ON/OFF의 요구사항·범위·제외 항목·인수 기준·체크리스트와 후속 우선순위를 기록함. 세부 계약은 기존 명세, 실제 상태·증거는 진행 기록에 유지함.
- 작업 규칙: 개발 시작 시 계획 두 파일과 진행 기록을 읽고, “다음 기능” 요청은 `NEXT.md`의 현재 작업으로 연결함. 작업 후 결과·미검증 항목과 다음 범위를 갱신하도록 AGENTS에 명시함. README에 남아 있던 이전 다음 작업 문구도 현재 계획으로 맞춤.
- 실제 검사: Python으로 문서의 로컬 링크 19개, Phase 0~8 포함, AGENTS 연결 확인. `git diff --check` 공백 오류 없음. `npm run lint` 경고 0개, `npm run typecheck` 성공, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 37.1kB, `/`·`/_not-found` 정적 빌드).
- 제한/다음 작업: 문서 정리만 수행했고 카운트인은 아직 미구현. 기존 사용자 테스트 중단 요청을 유지하여 단위·오디오·E2E·브라우저·실청취는 실행하지 않음. 다음 기능 개발은 `docs/plan/NEXT.md`의 카운트인 계획에서 시작함.
- Git: 기존 녹음 길이 기능의 미커밋 변경을 보존함. 브랜치 생성·스테이징·커밋·푸시·머지는 실행하지 않음.

### 2026-09-26 — Phase 0 오디오 시작·종료 안정화 / SYS-03, 관련 SYS-04

- 사용자 요청: 개발 계획의 Phase 0 진행. 기존 Phase 1·2 및 미커밋 변경은 보존하고 작은 수직 범위로 오디오 준비·취소·종료를 보강함. 카운트인은 후속 계획으로 유지함.
- 변경 파일: `src/audio/engine/test-tone-engine.ts`, 신규 `src/audio/engine/worklet-protocol.ts`, `src/audio/worklets/test-tone-processor.ts`, `src/components/audio/use-audio-session.ts`, `src/components/audio/audio-setup.tsx`, `src/lib/i18n/ko.ts`, 신규 `tests/audio/audio-engine.test.ts`·`tests/e2e/audio-lifecycle.spec.ts`, `README.md`, `docs/plan/README.md`, `docs/plan/NEXT.md`, 이 문서.
- 수정 전 정적 점검: 엔진 초기화는 Worklet 노드 생성 직후 완료되고 준비 상태도 노드 존재만 검사했음. 종료는 `AudioContext.close()` 완료 전에 엔진 참조를 비우며, 초기화 오류의 비동기 정리 뒤에는 소유 엔진을 다시 확인하지 않았음. 실제 브라우저에서 증상을 재현하거나 수정 후 실행한 것은 아님.
- 오디오 준비: Worklet이 첫 실제 블록을 처리한 뒤 버전·sampleRate·실제 블록 길이로 한 번 응답함. 메인 스레드는 이 응답을 확인한 뒤 마이크/트랙 컨트롤러를 붙이고 준비 완료를 표시함. 준비 완료 전 재생 명령은 보내지 않음. 오디오 시작/재개의 15초 시간 제한은 메인 스레드의 실패 감지용이며 음악 시계·녹음 경계에는 사용하지 않음. 초기화 실패/시간 초과는 자원 정리를 수행함.
- 수명 처리: 엔진의 초기화와 종료 Promise를 각각 공유함. 종료 실패 때 그래프를 중복 해제하지 않고 Context 종료를 재시도할 수 있게 함. UI는 종료가 끝날 때까지 엔진 참조를 유지하고 작업 번호와 엔진 일치 여부로 이전 비동기 결과를 무시함. 종료 실패 전용 버튼을 추가함. 마이크 요청은 별도 사용자 동작, 모니터링 기본 OFF, 개발용 신호임을 표시하는 기존 경계를 유지함.
- 작성한 검증: 단위 11개 — 중복 초기화, 첫 처리 응답 전 미준비, 192프레임 블록 수용, 로딩/처리 무응답, 잘못된 버전/샘플레이트/블록 길이, 취소 뒤 늦은 로딩, 시작 처리기 오류, 로딩 실패, 종료 실패 재시도, 중복 dispose와 늦은 메시지. production E2E 4개 — 실제 Worklet 준비 응답·테스트 신호 PCM ON/OFF·마이크 요청 없음·종료/재시작, 지연 종료 중 재시작 차단과 취소 뒤 늦은 실패, 파일 로딩 실패 재시도, 종료 실패 재시도. E2E는 실제 엔진을 관찰하며 오류/지연만 주입하도록 작성함. **모두 미실행으로 통과 여부는 미확인.**
- 당시 실제 검사(별도 녹음 길이 변경이 함께 있던 로컬 작업 트리): `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 37.4kB, `/`·`/_not-found` 정적 빌드), `npm run typecheck` 성공. 첫 `npm run lint`에서 새 테스트의 `module` 변수명이 Next.js 규칙에 걸려 `moduleLoad`로 수정했으며 재실행 성공(경고 0개). `npx react-doctor@latest --verbose --scope changed` 58개 파일 100/100, 전체 `npx react-doctor@latest --verbose` 신규 파일 포함 70개 파일 100/100, 진단 없음. `git diff --check` 공백 오류 없음.
- 미실행/제한: 기존 사용자 테스트 중단 요청을 유지해 `npm run test`, `npm run test:audio`, `npm run test:e2e`, 브라우저·실청취는 실행하지 않음. 브라우저별 Worklet 준비·출력, 취소/종료/재시작 겹침, 권한 거부·장치 없음·장치 전환/해제, 늦은 마이크 승인, Strict Mode/Fast Refresh의 중복 Context, 실제 장치 청취는 남음. 정적 검사와 번들 생성만으로 Phase 0·SYS-03/04를 검증 완료로 변경하지 않음.
- 다음 작업: 테스트 재개 요청 후 이 오디오 수명 단위/E2E와 Phase 0 권한·환경 진단·자원 해제를 먼저 확인하고 누적된 PCM·길이·믹서·저장 검증을 수행함. 그 전에는 테스트 보류 상태를 유지하며 추가 개발은 사용자 요청에 따라 선택함.
- Git: 기존 develop 작업 트리에 구현함. 브랜치 생성·스테이징·커밋·푸시·머지는 실행하지 않음.

### 2026-09-26 — Phase 시작 전 브랜치·개발 종료 후 커밋/푸시 규칙

- 사용자 상시 지시: Phase 개발 전에 작업 브랜치를 만들고 개발을 마치면 관련 변경을 커밋·푸시한다. 이후 같은 작업마다 재승인을 묻지 않는다. AGENTS.md, README.md, docs/plan/README.md와 NEXT.md에 반영함. merge·rebase·PR·배포 등은 별도 요청 범위로 유지함.
- 현재 Git 상태와 범위: `git fetch origin develop` 후 local/remote develop이 모두 `9aa7d0f`임을 확인하고 `feature/phase-0-audio-lifecycle`을 생성함. Phase 0 오디오 수명·회귀 시나리오·계획/규칙 문서 13개 파일만 커밋 대상으로 선택함. 기존 1/2/4/8마디·v5 변경은 이번 커밋에 섞지 않고 작업 트리에 보존하며, 공통 README/진행 기록/한국어 문구도 부분 스테이징함.
- 실제 검사: 선택한 Git index 전체를 임시 디렉터리로 추출해 해당 커밋 대상만 `NEXT_TELEMETRY_DISABLED=1 npm run build`(Worklet 36.6kB, 정적 페이지), `npm run lint`(경고 0개), `npm run typecheck`로 검사했고 모두 성공함. 원 작업 트리의 `npx react-doctor@latest --verbose --scope changed`는 61개 파일 100/100, 진단 없음. `git diff --cached --check`도 공백 오류 없음.
- 테스트 중단 요청 유지: 단위·오디오·E2E·브라우저·실청취는 미실행. 커밋·푸시는 구현 보관이며 Phase 0의 인수 기준 통과를 의미하지 않는다. 다음 작업은 테스트 재개 후 남은 Phase 0 검증과 오류 수정이다.
- 커밋·푸시 대상: 위 작업 브랜치의 Phase 0 변경과 상시 Git 규칙. 원격 반영 여부는 실제 push 결과와 로컬/원격 커밋 비교로 확인한다.

### 2026-09-26 — Phase 0 브랜치의 develop 통합

- 사용자 요청: Phase 0 작업을 develop에도 머지하고 푸시. 대상은 `feature/phase-0-audio-lifecycle`의 `0fab5f6`이며 기존 develop은 `9aa7d0f`다. 두 원격 브랜치를 fetch하고 로컬과 일치함을 확인한 뒤 별도 worktree의 develop에서 충돌 없이 통합함.
- 범위: SYS-03 오디오 수명 보강, 관련 SYS-04 준비 확인, 회귀 시나리오와 Phase 개발/Git 작업 문서. 기존 4마디·v4 저장 계약을 유지한다. 원 작업 트리의 녹음 길이·v5 관련 미커밋/미추적 파일 20개는 별도로 보존하며 이번 머지에 포함하지 않음. 이번 통합에서 추가한 파일 변경은 이 진행 기록뿐이다.
- 실제 검증: 통합 worktree에서 `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 36.6kB, `/`·`/_not-found` 정적 빌드), `npm run lint` 성공(경고 0개), `npm run typecheck` 성공. `npx react-doctor@latest --verbose --scope changed` 61개 파일 100/100, 진단 없음. `git diff --cached --check` 공백 오류 없음.
- 검증 제한: 기존 사용자 테스트 중단 요청을 유지하여 단위·오디오·E2E·브라우저·실청취를 실행하지 않음. Phase 0 및 관련 인수 기준의 미검증 상태는 그대로 유지함.
- 게시 대상: 검증한 통합 결과를 Conventional Commit 형식의 merge commit으로 기록하고 origin/develop에 push한다. 원격 반영 여부는 실제 push 결과와 로컬/원격 커밋 비교로 확인한다. 다음 작업은 테스트 재개 후 남은 Phase 0 검증과 오류 수정이다.

### 2026-09-26 — Phase 1 Tap Tempo / CLK-01

- 사용자 요청: 이전 작업 계획의 다음 기능 개발. 기존 상시 승인에 따라 `git fetch origin develop` 후 `09395d1`에서 `feature/phase-1-tap-tempo`와 별도 worktree를 만들어 개발을 시작함. 카운트인 브랜치 `feature/phase-1-count-in`의 `f7195e0`은 아직 develop에 통합하지 않았으므로 독립적으로 보존함. 원 작업 트리의 녹음 길이·v5 관련 미커밋/미추적 파일 20개도 이번 변경에 포함하지 않음. 카운트인과 합친 상태의 확인은 향후 통합 검증 범위다.
- 변경 파일: 신규 `src/audio/transport/tap-tempo.ts`, 기존 `src/components/audio/transport-controls.tsx`와 `src/lib/i18n/ko.ts`, 신규 `tests/audio/tap-tempo.test.ts`, `tests/e2e/tap-tempo.spec.ts`, `README.md`, `docs/plan/README.md`, `docs/plan/NEXT.md`, 이 문서.
- 입력 정책: 클릭 이벤트의 입력 시각을 받는 React/브라우저 독립 계산기를 추가함. 두 번부터 최근 최대 4개 유효 간격의 평균을 구하고 최종 BPM만 반올림함. 지원 40~240 BPM에 대응하는 250~1,500ms를 수용함. 250ms 미만은 기준 시각도 움직이지 않고 제외하며 1,500ms 초과는 새 시퀀스의 첫 Tap으로 취급함. 비유한·음수·역행·동일 시각은 제외함. 6/8·7/8에서도 명세 5.4절의 4분음표 기준을 유지함.
- UI와 실제 명령 경로: 기존 Radix 템포 팝오버에 TAP 버튼·제안값·안내와 잠금 이유를 표시함. Tap은 BPM 입력 초안만 바꾸고 사용자의 `설정 적용`에서 기존 `configureTransport` 명령을 보냄. “적용됨”은 기존 Worklet 응답 값으로 표시함. 오디오 미준비 및 루프·비운 루프 복구 이력·녹음 준비·편집·저장소 잠금을 UI에서 따르며 엔진의 최신 `loop.locked` 확인도 유지함. 오디오/마이크 자동 활성화나 Worklet 오디오 시계 변경은 없음.
- 입력 수명: Enter/Space 자동 반복 입력을 차단함. 수동 BPM 변경·설정 적용 때 Tap 기록을 지우고, 설정창 닫기와 준비/잠금 상태 변경 때 입력 폼을 초기화함. 다시 열면 현재 Worklet 또는 복구한 프로젝트의 BPM·박자를 초안으로 가져오며 적용 전 초안은 버림. 빈 프로젝트의 BPM을 독립 저장하는 기능은 추가하지 않았고 기존 녹음 프로젝트 메타데이터 저장 경로와 4마디·v4/v1~3 읽기 계약을 유지함.
- 작성한 검증: 단위 18개 — 지원 경계 40/240을 포함한 7개 BPM, 평균 후 반올림, 최근 네 간격·제한된 보관, 빠른 중복 입력에서 기준 시각 보존, 긴 중단 후 재시작, 잘못되거나 역행한 시각 6종, 명시적 초기화. production E2E 시나리오 4개 — 미준비 잠금·적용 전 미변경·실제 Worklet 설정 응답·6/8의 4분음표 BPM, 수동 입력/중단/다시 열기/오디오 재시작 초기화, 합성 마이크의 실제 녹음 및 비운 루프 복구 이력 잠금, Enter 자동 반복 차단. E2E는 일정한 간격 시나리오에서 UI 클릭 시각만 주입하고 엔진·Worklet은 대체하지 않음. **모두 미실행이며 통과 여부는 미확인.**
- 실제 실행: `npm run lint` 성공(경고 0개), `npm run typecheck` 성공, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 36.6kB, `/`·`/_not-found` 정적 빌드). `npx react-doctor@latest --verbose --scope changed` 61개 파일 100/100, 전체 `npx react-doctor@latest --verbose` 71개 파일 100/100, 진단 없음. 최종 공백 검사는 `git diff --check`로 확인함.
- 미실행/제한: 기존 사용자 요청대로 `npm run test`, `npm run test:audio`, `npm run test:e2e`, 브라우저 조작·실청취는 실행하지 않음. 실제 클릭/터치/키보드 입력 시각과 제안값, 모바일 팝오버 배치·포커스, 설정 반영과 재시작/저장 잠금은 미검증. Tap 간격은 제안값 계산용으로만 쓰며 실시간 오디오의 시계나 지연 보정값이 아님. 카운트인 통합 후 준비 중 잠금 검증도 남음. 구현은 보관하되 Phase 1·CLK-01 전체를 검증 완료로 변경하지 않음.
- 다음 작업: 상세 명세 4.6절·MIDI-01의 기본 키보드 연주 조작. 검증 재개 시 Phase 0과 누적 시나리오를 먼저 확인함. 관련 변경만 Conventional Commit으로 기록해 작업 브랜치에 push하고 로컬/원격 커밋 일치로 확인한다. develop 통합은 별도 요청 범위다.

### 2026-09-27 — Tap Tempo 브랜치의 develop 통합 / CLK-01

- 사용자 요청: 직전 Tap Tempo 작업을 develop에도 머지하고 푸시. `git fetch origin` 후 `feature/phase-1-tap-tempo`의 `8c4ed6f`와 develop의 `09395d1`이 각각 원격과 일치함을 확인하고 별도 develop worktree에서 충돌 없이 병합함.
- 범위: Tap Tempo 계산기·템포 설정 UI·한국어 안내·작성된 단위/E2E 시나리오 및 개발 문서. 이번 병합에서 추가로 수정한 파일은 통합 상태를 반영한 `README.md`, `docs/plan/{README,NEXT}.md`, 이 기록뿐이며 제품 코드와 테스트는 원본 기능 커밋과 동일함.
- 보존: 원 작업 트리의 녹음 길이·v5 관련 미커밋/미추적 파일 20개는 파일 목록과 SHA-256 비교로 변경 없음을 확인함. 카운트인 `feature/phase-1-count-in` / `f7195e0`은 이번 통합에 포함하지 않고 보존함. develop은 기존 4마디·v4 저장 계약을 유지함.
- 실제 검사: 병합 worktree에서 `npm run lint` 성공(경고 0개), `npm run typecheck` 성공, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 36.6kB, `/`·`/_not-found` 정적 빌드). `npx react-doctor@latest --verbose --scope changed`는 64개 파일 100/100, 진단 없음. `git diff --check`와 `git diff --cached --check` 공백 오류 없음.
- 검증 제한: 기존 사용자 테스트 중단 요청에 따라 단위·오디오·E2E·브라우저·실청취는 미실행. Tap Tempo와 Phase 0·1·2의 미검증 상태는 유지함.
- 게시 대상: 검증한 결과를 merge commit으로 기록해 origin/develop에 push하고 실제 원격 커밋과 로컬 커밋의 일치를 확인한다. 다음 기능은 기본 키보드 연주 조작이며 최신 원격 develop에서 새 작업 브랜치로 시작한다.

### 2026-09-27 — 남아 있던 녹음 길이 작업의 커밋·통합 준비 / CLK-03·CLK-05·LOOP-12·FILE-02·FILE-06

- 사용자 요청: Source Control에 남은 1/2/4/8마디 녹음·v5 저장 작업을 커밋·푸시하고 develop에 머지·푸시. 원본 20개 파일과 패치를 `/private/tmp/loop-station-record-length-dt90l3v5`에 백업하고 Git stash `252fb390`에도 보관한 뒤 최신 develop `5478f3d`에서 `feature/phase-2-recording-length`를 생성함.
- 병합 검토: 제품 코드는 자동 병합됐고 `docs/PROGRESS.md`의 이전/최신 기록 충돌은 두 기능의 구현 이력과 검증 제한을 모두 보존해 해결함. 원본의 제품·테스트 16개 파일은 SHA-256 일치, 한국어 파일은 녹음 길이 변경과 기존 Tap Tempo 안내 8개를 함께 보존함. README·로드맵·NEXT·진행 기록의 현재 상태를 갱신함. 추가 제품 코드 변경이나 의존성 변경은 없음.
- 실제 검사: `npm run lint` 성공(경고 0개), `npm run typecheck` 성공, `NEXT_TELEMETRY_DISABLED=1 npm run build` 성공(Worklet 37.4kB, `/`·`/_not-found` 정적 빌드). `npx react-doctor@latest --verbose --scope changed` 64개 파일, 전체 `npx react-doctor@latest --verbose` 신규 파일 포함 73개 파일에서 모두 100/100, 진단 없음. `git diff --check` 및 `git diff --cached --check` 공백 오류 없음.
- 제한: 사용자 테스트 중단 요청에 따라 단위·오디오·E2E·브라우저·실청취는 미실행. 길이별 경계·혼합 길이 반복·v1~v4→v5 저장 이전과 실제 UI 동작은 미검증 상태를 유지함. 작성된 단위 17개와 E2E 1개는 실행 성공을 의미하지 않음. 카운트인 브랜치는 별도로 보존하며 이번 통합 대상이 아님.
- 다음 순서: 기능 커밋과 원격 작업 브랜치 푸시 후 검증한 제품 코드를 develop에 병합·푸시한다. 현재 프로젝트 폴더의 미커밋 변경을 정리하고 로컬/원격 커밋 일치를 확인한다. 다음 개발 기능은 기본 키보드 연주 조작이다.

### 2026-09-27 — 녹음 길이·v5 저장의 develop 통합

- 기능 커밋: `97f7eff` (`feat(audio): add selectable recording lengths and v5 storage`), 원격 `feature/phase-2-recording-length`에 push 성공. 현재 프로젝트 폴더를 develop으로 전환하고 충돌 없이 병합함.
- 검증: 위 기능 커밋에서 실행한 린트·타입 검사·빌드·React Doctor 결과를 유지함. 병합 결과의 제품 코드·테스트·의존성은 검증한 `97f7eff`와 동일하며 추가 변경은 README·계획·진행 기록의 통합 상태뿐이다. 최종 스테이징 공백 검사 후 merge commit을 만들어 origin/develop에 push하고 로컬/원격 일치와 미커밋 변경 없음을 확인한다.
- 기존 테스트 중단 방침과 인수 기준의 미검증 상태는 그대로 유지함. 카운트인 `f7195e0`은 별도 브랜치에 보존했고 다음 기능은 기본 키보드 연주 조작이다.

## 알려진 제한과 차단 항목

Tap Tempo의 계산기·BPM 제안·설정 적용·잠금·초기화를 구현했으나 단위·브라우저 검증은 보류 상태다. 4분음표 간격으로만 계산하고 빈 프로젝트 템포의 독립 저장·글로벌 Tap 단축키는 제공하지 않는다. 카운트인은 별도 브랜치에 있으므로 두 기능을 합친 상태의 잠금·초기화도 향후 확인해야 한다.

Phase 0 시작·종료 보강은 정적 코드 점검을 근거로 구현했으며 실제 증상 재현/수정 후 재실행은 하지 않았다. Worklet 준비 응답과 시간 제한, 자원 해제·취소 후 재시작·실패 복구, Strict Mode/Fast Refresh와 브라우저별 AudioContext 동작은 테스트 재개 후 확인해야 한다. 빌드된 Worklet 파일의 생성 성공은 브라우저에서의 로딩·PCM 출력 성공과 구분한다.

AudioContext·Worklet·마이크 입력·공통 시계·메트로놈과 8트랙의 PCM 녹음·반복·오버더빙·Undo/Redo·프로젝트 자동 저장을 구현했지만 실제 Worklet 로딩, 장치 수명, 청취와 경계, IndexedDB 저장/복구·v1 이전은 미검증이다. 트랙 볼륨·팬·Mute·Solo, 루프 마스터 볼륨/음소거·PCM 미터와 v5 믹서·루프 길이 저장도 구현했으나 실제 동작 검증은 미완료다. 마스터는 루프 8트랙만 제어하고 모니터/클릭/테스트 신호는 제외한다. 최종 하드 클리핑은 음질 검증된 리미터가 아니다. 새 UI의 브라우저 확인도 미완료다. 각 트랙은 모노·1/2/4/8마디를 선택하며 한 번에 한 트랙 녹음/편집으로 제한한다. 녹음 전 빈 트랙의 길이 선택은 탭 안에서만 유지하고 실제 녹음 길이는 저장한다. 긴 녹음·오버더빙은 기존 메모리 예산에 따라 거절될 수 있다. 혼합 길이 동기·부분 녹음·이력·저장 이전과 새 선택 UI는 미검증이다. 채널 선택, AUTO 모니터링, 연속 오버더빙, 다단계 Undo, 프로그램 버스 통합·안전 리미터, 녹음 journal, 프로젝트 목록, 파일 백업, FX, MIDI, 클라우드는 미구현이다. 저장 실패 또는 메모리 전용 모드의 변경은 탭 종료 시 사라질 수 있다. 새 프로젝트/데모/FX 버튼은 이유와 함께 비활성화한다.

시간 변환 단위 테스트는 실제 오디오 시계의 동작이나 장시간 동기화를 보장하지 않는다. 실제 마이크·헤드폰·인터페이스 청취 및 Chrome/Edge/Firefox/Safari 지원 범위 검증은 남아 있다.

## 다음 Codex 작업

시작 시 `AGENTS.md`, [개발 로드맵](plan/README.md), [현재 작업 계획](plan/NEXT.md), 이 기록을 읽는다. 다음 기능은 기본 키보드 연주 조작이다. Tap Tempo와 1/2/4/8마디 녹음 길이는 구현 완료/미검증이며 카운트인은 별도 브랜치의 구현·미통합 상태다. 테스트 재개 요청 후 Phase 0의 `audio-engine.test.ts`·`audio-lifecycle.spec.ts`, 권한·환경 진단·장치 해제를 먼저 확인하고 Tap Tempo·길이별 PCM·오버더빙·이력·v1~v4→v5 저장 이전·믹서, `mixed-loop-lengths.test.ts`의 10분 DSP 시나리오와 `local-save.spec.ts`를 검증한다. 그 전에는 Phase 0/1/2와 인수 기준을 검증 완료로 표시하지 않는다. 현재 저장 형식은 schemaVersion 5이고 v1/v2/v3/v4 읽기 이전을 지원한다. 다음 변경도 기존 데이터를 보존한다. 선택 길이는 준비 시작 시 고정하고 PCM 메타데이터의 ticks를 반복·오버더빙·이력 기준으로 유지한다. 후속 세부 범위는 NEXT.md를 따른다.
