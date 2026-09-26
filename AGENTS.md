# AGENTS.md

## 제품과 문서

브라우저에서 실제로 연주할 수 있는 웹 루프스테이션을 만든다. 음성을 녹음하고, 반복 재생 위에 소리를 쌓고, 여러 트랙과 장면을 박자에 맞춰 제어하고, 작업을 저장하거나 WAV로 내보내는 제품이다. 이름 `Loop Station Web`은 임시 작업명이다.

- 상세 요구사항, 오디오 설계, 데이터 모델, 구현 단계, 검수 기준, 출처: `docs/LOOP_STATION_SPEC.md`.
- 합의한 Phase별 개발 순서와 작업 방식: `docs/plan/README.md`. 바로 다음 기능의 범위·인수 기준·후속 우선순위: `docs/plan/NEXT.md`.
- 현재 구현 상태, 실제 검증 결과, 결정 기록, 다음 작업: `docs/PROGRESS.md`.
- 시작할 때 이 파일, 기존 `package.json`과 저장소 구조, `docs/plan/README.md`, `docs/plan/NEXT.md`, `docs/PROGRESS.md`를 읽는다. 첫 작업에서는 상세 명세의 0~5절과 8~10절도 읽고, 이후에는 해당 요구사항과 관련 절을 읽는다.
- 이 파일은 핵심 규칙만 유지한다. 상세 명세를 이곳에 복사하거나 불필요한 Markdown 문서를 늘리지 않는다. 기존 사용자 파일은 임의로 삭제하지 않는다.

## 고정 기술 규칙

- Next.js App Router, React, TypeScript strict를 사용한다.
- 패키지 관리는 npm만 사용하고 `package-lock.json`을 유지한다. pnpm, yarn, bun으로 바꾸지 않는다.
- 공통 UI는 Radix Themes를 디자인 시스템으로 사용한다. 새 화면은 루트 테마와 Radix 컴포넌트·토큰을 재사용하고, Tailwind CSS는 배치 유틸리티로 사용한다. 다른 UI 컴포넌트 시스템을 중복 도입하지 않는다.
- 설치 시점의 공식 문서와 npm 배포 정보를 확인해 호환되는 안정 버전을 선택하고 실제 버전을 진행 문서에 기록한다. 기존 프로젝트라면 무관한 메이저 업그레이드를 하지 않는다.
- 녹음과 연주 엔진은 브라우저의 Web Audio API와 AudioWorklet을 사용한다. React는 화면과 명령 전달을 담당하고 실제 오디오 시계가 되지 않는다.
- 기본 저장은 IndexedDB 기반 로컬 우선 방식이다. 서버 DB가 필요한 클라우드 기능은 Supabase Auth, Postgres, Storage를 사용한다. Supabase 환경변수 없이도 로컬 모드가 실행되어야 한다.
- 마이크, AudioContext, IndexedDB, Web MIDI 등 브라우저 API를 서버 모듈 최상위에서 실행하지 않는다. 실시간 엔진과 DSP는 React에 의존하지 않게 분리한다.

## 반드시 지킬 품질 경계

- 실제 PCM 녹음, 반복 재생, 오버더빙부터 검증한다. 애니메이션, 타이머, 가짜 파형만으로 기능 완료를 선언하지 않는다.
- `setInterval`, `setTimeout`, `requestAnimationFrame`, React 렌더링을 루프 경계의 기준 시계로 사용하지 않는다. 타이머는 사전 스케줄 공급이나 화면 갱신에만 허용한다.
- 압축된 MediaRecorder 청크를 이어 붙여 핵심 루핑 엔진으로 사용하지 않는다. 실시간 경로는 PCM과 오디오 프레임을 기준으로 한다.
- AudioWorklet의 `process()`에서 네트워크, 파일 저장, Promise, 로그, 큰 배열 생성, 무제한 메모리 증가를 금지한다. 실제 블록 길이를 읽고 128 프레임을 상수로 가정하지 않는다.
- 입력 모니터링은 기본 OFF다. 마이크는 명시적인 사용자 동작으로 활성화하고, 항상 녹음 중인 것처럼 숨겨서 수집하지 않는다. 클라우드 업로드는 사용자 선택 없이 시작하지 않는다.
- 루프 길이와 전환은 공통 오디오 시계로 처리한다. 지연 보정, 피드백, Undo, 장면 전환, 저장 중 실패는 상세 명세의 계약을 지킨다.
- React 상태나 JSON에 대형 PCM 배열을 넣지 않는다. 녹음 전에 메모리와 저장 가능 용량을 검사한다.
- 기본 소리와 프로젝트를 파괴하는 조작에는 복구 방법을 제공한다. 지원하지 않는 기능은 이유와 함께 비활성화한다. 빈 이벤트 핸들러나 성공 토스트로 구현을 대신하지 않는다.
- Supabase 서비스 역할 키, secret key, 로그인 토큰을 클라이언트 코드, 공유 파일, 로그에 넣지 않는다. 공개 키 사용 여부와 관계없이 사용자 데이터에는 RLS와 Storage 권한 정책을 적용한다.
- 자료는 기능 연구용이다. 경쟁 제품의 코드, 로고, 샘플, 프리셋, 화면을 무단 복제하지 않는다. 외부 DSP 코드와 음원은 라이선스를 확인하고 출처를 기록한다.

## 작업 방식과 검증

한 작업에서는 현재 단계의 작은 수직 기능 단위를 구현한다. 한 번에 모든 단계를 억지로 완성하지 않는다. 외부 계정이나 장비가 없으면 로컬 대체 경로를 진행하고 실제 검증하지 못한 항목을 남긴다. 어려운 기능을 말없이 삭제하거나 핵심 기능을 Mock으로 대체하지 않는다.

사용자가 “다음 기능” 개발을 요청하면 `docs/plan/NEXT.md`의 현재 작업을 기준으로 진행한다. 시작 시 요구사항 ID·범위·검증 항목을 정리하고, 작업 후 실제 결과는 `docs/PROGRESS.md`, 다음 범위와 순서는 `docs/plan/NEXT.md`에 갱신한다. Phase 범위·순서가 바뀌면 로드맵도 함께 수정한다. 사용자의 최신 지시를 우선하며, 계획만으로 미검증 기능을 완료 처리하거나 중단한 테스트를 재개하지 않는다.

변경 후 다음 명령을 실제로 실행한다. 초기 단계에서 필요한 스크립트는 먼저 만든다.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

브라우저와 오디오 동작을 바꿨으면 관련 `npm run test:e2e`도 실행한다. 하드웨어 지연과 실청취는 자동 테스트와 별개로 기록한다. 미실행, 실패, 환경 제약을 통과로 표시하지 않는다. 신규 `any`, 검증 무시 주석, 테스트 삭제로 오류를 숨기지 않는다.

기존 Git 규칙과 사용자 변경을 보존한다. 사용자의 2026-09-26 상시 지시에 따라 Phase 개발 시작 전에 작업 브랜치를 만들고, 해당 개발을 마치면 허용된 검사를 거쳐 commit과 push까지 진행한다. 세부 범위는 아래 사용자 Git 작업 규칙을 따른다. 배포, 유료 리소스 생성, 파괴적 Git 명령은 별도 명시적 요청 없이 실행하지 않는다.

작업이 끝나면 `docs/PROGRESS.md`에 요구사항 ID, 변경 파일, 실제 실행한 명령과 결과, 알려진 제한, 다음 작업을 기록한다. 사용자에게도 구현 내용과 미완료 내용을 구분해 보고한다. 요구사항의 인수 기준을 충족한 경우에만 완료로 변경한다.

## 사용자 Git 작업 규칙

- 사용자 상시 승인(2026-09-26): 각 Phase 개발을 시작하기 전에 작업 브랜치를 만들고, 해당 개발을 마치면 관련 변경을 commit하고 원격 작업 브랜치에 push한다. 이후 Phase 개발 요청마다 이 세 작업의 승인을 다시 묻지 않는다.
- 최신 원격 develop을 확인하고 `feature/phase-<번호>-<작업>` 등 의도가 드러나는 짧은 feature/*, fix/*, docs/*, refactor/*, test/*, chore/* 브랜치에서 시작한다. 이미 같은 작업 브랜치에서 진행 중이면 이어서 사용한다. 다른 미커밋 변경은 보존하고 이번 commit에 섞지 않는다.
- Git 초기화, tag, release, merge, rebase, PR 생성, 배포는 이번 상시 승인에 포함되지 않으며 별도 명시적 요청이 필요하다.
- 일반 PR 대상은 develop, 안정 릴리스는 develop → main 전용 PR이다. develop/main 직접 commit은 해당 작업의 명시적 요청이 있어야 한다.
- Conventional Commits 형식 type(scope): subject를 사용한다. 한 브랜치와 PR은 하나의 변경만 담는다.
- 사용자 변경을 보존하고 git add .를 사용하지 않는다. force-push, 공유 이력 재작성, 파괴적 Git 명령은 명시적 허가 없이는 실행하지 않는다.
- push/PR 전에 관련 lint, typecheck, test 및 변경에 필요한 추가 검증을 실제 실행한다. 사용자 테스트 중단 요청은 재개 지시 전까지 우선하며, 이때 허용된 정적 검사·빌드를 실행하고 테스트 미실행 및 미검증 상태를 문서와 완료 보고에 명시한다. commit/push는 Phase 인수 기준 통과를 뜻하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
