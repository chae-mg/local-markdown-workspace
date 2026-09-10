# Local-first Markdown Workspace

Chrome에서 설치 없이 사용하는 **Local-first Markdown Workspace**입니다.

일반 문서는 표준 Markdown으로 작성하고, Database형 문서는 Markdown + Schema + View 구조로 관리합니다.

## 핵심 방향

- Chrome 전용 웹앱
- 별도 프로그램 설치 불필요
- Local-first
- Markdown Single Source of Truth
- 비개발자 친화적 WYSIWYG Editor
- Notion 스타일 Table / Kanban View
- 앱 데이터와 사용자 Content 분리
- AI에 전달하기 쉬운 Markdown 유지

## 문서 구성

```text
.
├─ app/                       # 실행 가능한 웹앱과 테스트
│  ├─ src/
│  ├─ e2e/
│  ├─ package.json
│  └─ vite.config.ts
├─ .github/workflows/         # CI와 GitHub Pages 배포
├─ README.md
├─ PRD.md
├─ PLAN.md
└─ docs/
   ├─ ARCHITECTURE.md
   ├─ DATA_MODEL.md
   └─ ADR/
      ├─ 001-chrome-only.md
      ├─ 002-local-first.md
      ├─ 003-markdown-source-of-truth.md
      └─ 004-schema-view-separation.md
```

## 문서 역할

### `PRD.md`
무엇을 만들지 정의합니다.

- 제품 목적
- 사용자
- 기능 요구사항
- MVP 범위
- 비기능 요구사항
- 성공 기준

### `PLAN.md`
어떻게 구현할지 정의합니다.

- 기술 Stack
- Architecture
- Milestone
- 구현 순서
- 테스트
- Migration
- Release 기준

### `docs/ARCHITECTURE.md`
전체 시스템 구조와 Layer별 책임을 정의합니다.

### `docs/DATA_MODEL.md`
Workspace, Database, Item, Property, View 등 핵심 데이터 모델을 정의합니다.

### `docs/ADR/`
중요한 기술·제품 설계 결정을 기록합니다.

## 권장 개발 순서

```text
1. 개발 환경 / CI
2. File System Access
3. Workspace / File Tree
4. Markdown Parser
5. External Change Guard / Markdown Editor
6. Attachment
7. Database / Schema
8. Table / Kanban / View
9. External Change Detection 고도화
10. Undo / Backup / Trash
11. Search / Health Check
12. Migration / Release
```

## 확정된 구현 기준

- Package Manager: pnpm
- Hosting: GitHub Actions를 통한 GitHub Pages 배포
- Routing: GitHub Pages 호환을 위한 Hash Routing
- 영속 View Model: `databaseId`, `filters`, `sorts`, `propertyOrder`, `hiddenProperties`
- 파일 삭제: `.workspace/trash/`로 이동 후 명시적 영구 삭제
- Auto Save: 저장 직전 외부 변경 검사를 통과한 경우에만 실행

## 현재 구현 상태

Phase 0 개발 환경부터 Phase 5 Markdown Editor까지 구현했습니다.

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui 구조
- Pretendard Variable 한글 Webfont
- ESLint + Prettier
- Vitest + React Testing Library
- Playwright
- GitHub Actions CI + GitHub Pages 배포
- Hash Routing 기반 Workspace 진입 화면
- Chrome Folder Picker와 Read/Write Permission 흐름
- 최근 `FileSystemDirectoryHandle`의 IndexedDB 저장과 복원
- File/Folder 조회, 생성, 읽기, 쓰기, 이동, 삭제, Metadata API
- Workspace 상대 경로 검증과 `.workspace/` 보호
- 복사 검증 후 원본을 제거하는 안전한 이동 Fallback
- 빈 폴더의 기본 Workspace 구조 자동 생성
- 기존 파일이 있는 폴더의 명시적 초기화 확인
- `workspace.json` 생성·검증과 immutable Workspace ID 복원
- `.workspace/`를 제외한 Markdown Workspace Scan
- File Tree 펼치기·접기·선택·새로고침
- File Tree 로딩·오류·빈 상태와 선택 유효성 검사
- 선택한 폴더에 새 Markdown 문서와 하위 폴더 생성
- 기존 항목 덮어쓰기 방지와 파일명 안전성 검사
- 파일·폴더 이름 변경과 충돌 방지
- 휴지통 이동 시 payload, 원래 상대 경로, 삭제 시각 Metadata 보존
- YAML 1.2 Frontmatter 파싱·수정·직렬화와 원문 형식 보존
- Milkdown Crepe 기반 WYSIWYG Markdown 편집기
- WYSIWYG / Markdown 원문 모드 전환
- 1초 Debounce 자동 저장과 수동 저장 상태 표시
- 저장 직전 수정 시각·원문 비교를 통한 외부 변경 충돌 방지
- 충돌 시 디스크 버전 다시 불러오기 또는 명시적 덮어쓰기
- 시각 편집기의 Markdown 정규화 가능성 감지와 자동 저장 중단
- 휴지통 목록 조회와 원래 위치 복원, 충돌 시 다른 이름으로 복원
- 되돌릴 수 없음을 확인한 뒤에만 실행되는 명시적 휴지통 비우기
- 파일·폴더 Drag & Drop 이동과 모바일·키보드용 목적지 선택 이동
- 동일 이름 충돌과 폴더의 자기 하위 경로 이동 방지
- YAML 1.2 기반 Markdown Frontmatter Parse·Serialize·부분 업데이트
- Frontmatter 미변경 시 BOM·주석·따옴표·줄바꿈과 Markdown Body 원문 보존
- 잘못된 YAML, 중복 Key, 비객체 Root와 지원하지 않는 값 차단

## 로컬 실행

요구사항:

- Node.js 22.12 이상
- pnpm 11.19

```bash
cd app
pnpm install
pnpm dev
```

전체 검증:

```bash
cd app
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

로컬 E2E는 설치된 Google Chrome을 사용합니다. GitHub Actions에서는 Playwright Chromium을 별도로 설치합니다. OPFS Directory Handle 직렬화는 Linux Headless Chromium을 종료시키므로, 실제 Handle 저장·복원 E2E는 로컬 Chrome에서 실행하고 CI에서는 관련 Store와 Service를 단위·통합 테스트로 검증합니다.

실제 사용자 Markdown Workspace는 이 저장소 밖에 둡니다. 자동화 테스트용 Workspace가 필요하면 `app/test/fixtures/workspaces/` 아래에 재현 가능한 Fixture만 추가합니다.

## 개발 원칙

1. 사용자 Content는 일반 Markdown으로 유지합니다.
2. IndexedDB는 Source of Truth로 사용하지 않습니다.
3. UI Component가 File System Access API를 직접 호출하지 않습니다.
4. ID와 Display Name을 분리합니다.
5. Property 삭제는 Soft Delete만 지원합니다.
6. 데이터 손실보다 기능 제한을 우선합니다.
7. 외부 Editor와의 호환성을 유지합니다.
