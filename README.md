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

## 개발 원칙

1. 사용자 Content는 일반 Markdown으로 유지합니다.
2. IndexedDB는 Source of Truth로 사용하지 않습니다.
3. UI Component가 File System Access API를 직접 호출하지 않습니다.
4. ID와 Display Name을 분리합니다.
5. Property 삭제는 Soft Delete만 지원합니다.
6. 데이터 손실보다 기능 제한을 우선합니다.
7. 외부 Editor와의 호환성을 유지합니다.
