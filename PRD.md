# PRD.md — Local-first Markdown Workspace

## 1. 문서 목적

이 문서는 Chrome 브라우저에서 설치 없이 사용할 수 있는 **Local-first Markdown Workspace**의 제품 요구사항을 정의한다.

이 제품은 Obsidian처럼 로컬 Markdown 파일을 중심으로 문서를 관리하되, 별도 프로그램 설치 없이 Chrome에서 실행되고, 비개발자도 쉽게 사용할 수 있도록 WYSIWYG 편집과 Notion 스타일의 Database View(Table/Kanban)를 제공하는 것을 목표로 한다.

---

## 2. 제품 한 줄 정의

> Chrome에서 설치 없이 사용하는 Local-first Markdown Workspace.  
> 일반 문서는 Markdown으로 작성하고, Database형 문서는 Markdown + Schema 구조로 관리하며, Table/Kanban View를 제공한다.

---

## 3. 문제 정의

Markdown은 AI에게 Context를 전달하거나 장기적으로 문서를 보존하기 좋은 포맷이지만, 일반 사용자가 직접 사용하기에는 다음과 같은 진입장벽이 있다.

- VS Code 설치 및 초기 설정이 필요하다.
- Markdown 문법에 익숙하지 않은 사용자는 작성이 어렵다.
- 단순 Markdown Editor는 문서 관리 기능이 부족하다.
- Obsidian은 강력하지만 프로그램 설치가 필요하고 기능이 많아 처음 사용하는 사람에게는 복잡할 수 있다.
- Notion은 Database와 View 기능이 편리하지만 데이터가 특정 서비스에 종속된다.
- 회사 환경에서는 프로그램 설치 권한이나 외부 SaaS 사용 제약이 존재할 수 있다.
- 여러 Markdown 파일을 AI에 전달할 때 필요한 문서를 매번 선택하고 정리하는 작업이 번거롭다.

---

## 4. 제품 목표

### 4.1 핵심 목표

1. 별도 프로그램 설치 없이 Chrome에서 사용할 수 있어야 한다.
2. 실제 사용자 데이터는 로컬 파일 시스템에 저장되어야 한다.
3. 일반 사용자는 Markdown 문법을 몰라도 문서를 작성할 수 있어야 한다.
4. 모든 일반 문서는 표준 `.md` 파일로 유지되어야 한다.
5. Markdown 파일을 Database Row처럼 활용할 수 있어야 한다.
6. 하나의 Database 데이터를 Table / Kanban 등의 여러 View로 표현할 수 있어야 한다.
7. 앱이 없어져도 사용자의 Markdown 파일은 독립적으로 열 수 있어야 한다.
8. 외부 Editor(VS Code, Obsidian 등)에서 수정해도 최대한 호환되어야 한다.

### 4.2 장기 목표

- AI Context Export
- Database Filter / Sort 고도화
- 여러 View 저장
- Template 시스템
- Workspace Health Check
- Relation / Formula 등 선택적 고급 기능
- PWA 설치 지원

---

## 5. 비목표

초기 버전에서는 다음 기능을 목표로 하지 않는다.

- 실시간 공동 편집
- 사용자 계정
- 서버 Database
- Cloud Sync
- 자체 AI Chatbot
- Notion 전체 기능 복제
- Obsidian Plugin 생태계 복제
- Formula / Rollup / Relation의 초기 구현
- Graph View
- 모바일 최적화
- Safari / Firefox 지원
- Windows/macOS 네이티브 앱

---

## 6. 대상 사용자

### Primary User

Markdown을 업무 문서 포맷으로 사용하고 싶지만 개발 도구 사용에는 익숙하지 않은 사용자.

예시:

- Business Analyst
- Data Analyst
- Operations Analyst
- PM / PO
- 기획자
- 운영 담당자
- WFM 담당자
- 고객센터/BPO 운영 담당자
- AI를 업무에 자주 사용하는 일반 사무직

### Secondary User

이미 VS Code / Obsidian / Git 등을 사용하지만 설치 제한이 있는 환경에서 가벼운 Markdown Workspace가 필요한 사용자.

---

## 7. 핵심 가치

### 7.1 Local-first

문서와 Database Item은 사용자의 로컬 Workspace에 저장한다.

앱 서버에는 사용자 문서를 업로드하지 않는다.

### 7.2 Markdown First

일반 문서는 표준 Markdown으로 유지한다.

특정 앱에 종속되는 전용 포맷을 사용자 Content에 강제하지 않는다.

### 7.3 Simple UX

사용자는 Markdown 문법을 알 필요가 없어야 한다.

WYSIWYG Editor, Toolbar, Slash Command 등으로 문서를 작성할 수 있어야 한다.

### 7.4 Markdown as Data

Markdown Frontmatter를 활용해 각 Markdown 파일을 Database의 Row처럼 사용할 수 있어야 한다.

### 7.5 Separation of Data / Schema / View

다음 세 가지를 분리한다.

- Markdown = 실제 사용자 데이터
- Schema = Property 구조
- View = 데이터를 보여주는 방식

---

# 8. 플랫폼 요구사항

## 8.1 지원 환경

초기 공식 지원 환경:

- Google Chrome 최신 버전
- Windows
- macOS

## 8.2 실행 방식

Static Web Application 형태로 배포한다.

예:

- Cloudflare Pages
- GitHub Pages
- 기타 HTTPS Static Hosting

## 8.3 필수 Browser API

- File System Access API
- IndexedDB
- Clipboard API
- Drag and Drop API

---

# 9. Workspace

## 9.1 Workspace 정의

사용자가 처음 선택한 Local Folder를 하나의 Workspace로 정의한다.

예:

```text
MyWorkspace/
├─ Documents/
├─ Databases/
├─ Attachments/
└─ .workspace/
```

## 9.2 최초 실행

최초 실행 시:

```text
앱 실행
→ Workspace 선택
→ Chrome 폴더 접근 권한 승인
→ Workspace 구조 Scan
→ Workspace 초기화
```

## 9.3 최근 Workspace 기억

`FileSystemDirectoryHandle`을 IndexedDB에 저장한다.

다음 실행 시:

```text
앱 실행
→ IndexedDB에서 최근 Workspace 확인
→ 권한 확인
→ 권한이 유효하면 자동 열기
→ 권한이 없으면 접근 재승인 요청
```

## 9.4 여러 Workspace

향후 여러 Workspace를 기억할 수 있도록 구조를 설계한다.

예:

```text
최근 Workspace

회사 업무
개인 프로젝트
AI 문서

+ 다른 Workspace 열기
```

MVP에서는 최소 최근 Workspace 1개 지원을 기본으로 한다.

---

# 10. 권장 Workspace 파일 구조

```text
MyWorkspace/
│
├─ Documents/
│  ├─ 업무가이드.md
│  ├─ 회의록.md
│  └─ 프로젝트개요.md
│
├─ Databases/
│  └─ Projects/
│     └─ items/
│        ├─ project-a.md
│        ├─ project-b.md
│        └─ project-c.md
│
├─ Attachments/
│  ├─ img_a12f.png
│  └─ file_b92e.pdf
│
└─ .workspace/
   ├─ workspace.json
   ├─ schemas/
   │  └─ db_a81f23.json
   ├─ views/
   │  └─ view_c21a90.json
   ├─ cache/
   └─ backup/
```

---

# 11. ID 정책

사용자 표시 이름과 내부 식별자를 분리한다.

다음 Entity에는 모두 immutable ID를 부여한다.

- Workspace
- Database
- Item
- Property
- View

예:

```text
Workspace: ws_a81f23
Database: db_f82c11
Item: item_10ab42
Property: prop_7f3a91
View: view_a2bc11
```

ID는 생성 이후 변경하지 않는다.

삭제된 ID는 재사용하지 않는다.

---

# 12. 일반 Document

## 12.1 생성

사용자는 Workspace 내에서 일반 Markdown Document를 생성할 수 있어야 한다.

지원 기능:

- 새 문서
- 새 폴더
- 문서 이름 변경
- 문서 이동
- 문서 삭제
- 문서 복제

## 12.2 저장 포맷

일반 문서는 `.md`로 저장한다.

예:

```markdown
# 월간 리포트

## 목적

월간 운영 결과를 정리한다.

## 주요 KPI

| KPI | Target |
|---|---:|
| CSAT | 90% |
| FCR | 80% |
```

---

# 13. Markdown Editor

## 13.1 Editor Mode

기본 편집은 WYSIWYG 방식으로 제공한다.

지원 대상:

- Heading
- Paragraph
- Bold
- Italic
- Strike
- Bullet List
- Ordered List
- Checkbox
- Blockquote
- Code Block
- Inline Code
- Link
- Image
- Table
- Horizontal Rule

## 13.2 Source Mode

WYSIWYG 외에 Markdown Source Mode를 지원한다.

```text
[Editor] [Markdown]
```

목적:

- 고급 사용자 지원
- 지원하지 않는 Markdown Syntax 확인
- 외부 Editor와의 호환성 유지
- Markdown 원문 손상 방지

## 13.3 Markdown 보존 원칙

Editor가 이해하지 못하는 Markdown을 임의로 삭제하거나 변환하지 않아야 한다.

완전한 보존이 불가능한 Syntax가 존재할 경우 저장 전 사용자에게 경고한다.

---

# 14. Attachment

## 14.1 저장 위치

Attachment는 기본적으로 Workspace의 `Attachments/`에 저장한다.

## 14.2 파일명

충돌 방지를 위해 자동 ID 기반 파일명을 사용할 수 있다.

예:

```text
img_a72f82.png
attachment_b82c91.pdf
```

## 14.3 Markdown 참조

절대 경로 대신 상대 경로를 사용한다.

예:

```markdown
![Dashboard](../Attachments/img_a72f82.png)
```

Workspace 전체를 다른 PC로 이동해도 링크가 유지되어야 한다.

---

# 15. Database

## 15.1 Database 정의

하나의 Database는 다음으로 구성된다.

```text
Database
├─ Schema
├─ Views
└─ Items (*.md)
```

## 15.2 Item

Database Item 하나는 Markdown 파일 하나이다.

예:

```markdown
---
id: item_a83f21
prop_01: 진행중
prop_02: 높음
prop_03: 2026-09-30
---

# Dashboard 개선

Dashboard Filter 기능을 개선한다.

## 요구사항

- Date Filter
- Export
- 계산필드
```

---

# 16. Property

## 16.1 MVP Property Type

MVP에서 다음 Type을 지원한다.

- Text
- Number
- Select
- Multi-select
- Checkbox
- Date

## 16.2 Property 구조

예:

```json
{
  "prop_7f3a91": {
    "name": "우선순위",
    "type": "select",
    "deleted": false,
    "options": [
      "높음",
      "중간",
      "낮음"
    ]
  }
}
```

## 16.3 Property ID

Property 생성 시 내부 Key를 자동 생성한다.

예:

```text
prop_7f3a91
```

사용자는 내부 Key를 직접 입력하지 않는다.

## 16.4 Display Name

사용자는 Property 이름을 자유롭게 변경할 수 있다.

예:

```text
우선순위
→ 중요도
```

이때 내부 ID는 변경하지 않는다.

## 16.5 Property 삭제

물리 삭제는 제공하지 않는다.

삭제는 Soft Delete로만 처리한다.

예:

```json
{
  "prop_7f3a91": {
    "name": "우선순위",
    "deleted": true
  }
}
```

결과:

- Table에서 숨김
- Kanban에서 숨김
- Filter에서 숨김
- Markdown Frontmatter 값은 유지
- 복원 가능

## 16.6 삭제 Property 복원

`삭제된 Property` 화면에서 복원할 수 있어야 한다.

---

# 17. Schema

## 17.1 저장 위치

```text
.workspace/schemas/
```

## 17.2 Schema 파일

예:

```json
{
  "schemaVersion": 1,
  "id": "db_a81f23",
  "name": "Project",
  "properties": {
    "prop_01": {
      "name": "상태",
      "type": "select",
      "deleted": false,
      "options": [
        "예정",
        "진행중",
        "완료"
      ]
    }
  }
}
```

## 17.3 Schema 변경

지원:

- Property 추가
- 이름 변경
- 순서 변경
- Type 변경
- Select Option 추가
- Select Option 이름 변경
- Property Soft Delete
- Property Restore

Type 변경은 데이터 손실 가능성이 있으므로 validation이 필요하다.

---

# 18. View

## 18.1 View 정의

View는 Database 데이터를 어떻게 표시할지 정의한다.

Schema와 별도 저장한다.

## 18.2 MVP View

- Table
- Kanban

## 18.3 View 파일

```json
{
  "version": 1,
  "id": "view_01",
  "database": "db_01",
  "name": "상태별 보기",
  "type": "kanban",
  "groupBy": "prop_01",
  "filter": [],
  "sort": [
    {
      "property": "prop_03",
      "direction": "asc"
    }
  ]
}
```

---

# 19. Table View

지원 기능:

- Column 표시
- Column 숨기기
- Column 순서 변경
- Cell 직접 수정
- Select Dropdown
- Multi-select
- Date Picker
- Checkbox
- Sort
- Filter
- Row 생성
- Row 삭제
- Row 클릭 시 Document 열기

Column과 Property는 동일한 개념이지만 View별 표시 여부/순서는 별도 관리한다.

---

# 20. Kanban View

Kanban은 Select Property를 기준으로 Grouping한다.

예:

```text
예정            진행중            완료

Project C       Project A         Project B
                Project D
```

Card Drag & Drop 시 해당 Item의 Markdown Frontmatter 값을 변경한다.

예:

```yaml
prop_01: 예정
```

↓

```yaml
prop_01: 진행중
```

Table과 Kanban은 항상 동일한 Markdown 데이터를 사용한다.

---

# 21. Search

Workspace 전체 Markdown을 검색할 수 있어야 한다.

MVP 검색 범위:

- 파일명
- 문서 제목
- Markdown 본문
- Database Property 값

검색 Index는 IndexedDB 또는 `.workspace/cache/`에 Cache할 수 있다.

실제 Source of Truth로 사용해서는 안 된다.

---

# 22. 외부 수정 감지

사용자는 Workspace 파일을 다음 도구로 직접 수정할 수 있다.

- VS Code
- Obsidian
- Text Editor
- Git
- File Explorer/Finder

파일을 Editor에서 열 때 `lastModified`를 저장한다.

저장 직전에 파일 상태를 다시 확인한다.

외부 수정이 감지되면 자동 overwrite하지 않는다.

예:

```text
이 문서가 외부에서 변경되었습니다.

[다시 불러오기]
[내 변경사항 유지]
```

향후 Diff View 추가를 고려한다.

---

# 23. Backup / Undo

## 23.1 목적

다수의 Markdown 파일에 영향을 주는 작업의 안전성을 높인다.

예:

- Kanban 대량 이동
- Property Type 변경
- Schema Migration
- Batch Edit

## 23.2 저장 위치

```text
.workspace/backup/
```

## 23.3 MVP

최소 다음을 지원한다.

- 마지막 변경 Undo
- 중요 변경 전 Snapshot
- Schema 변경 Snapshot

Git 수준의 Version Control은 범위에서 제외한다.

---

# 24. Workspace Version

Workspace Metadata에 Version을 저장한다.

```json
{
  "workspaceVersion": 1,
  "id": "ws_a912cd",
  "name": "회사 업무"
}
```

Schema와 View에도 Version을 둔다.

목적:

- 향후 데이터 구조 변경
- Migration
- 구버전 Workspace 지원
- 호환성 확인

---

# 25. Workspace Health Check

Workspace 구조를 검사하는 기능을 제공한다.

검사 대상:

- Schema 파일 존재 여부
- Item ID 중복
- Database ID 중복
- 존재하지 않는 Property
- Schema 없는 Frontmatter Property
- 깨진 Attachment Link
- 참조되지 않는 Attachment
- 잘못된 JSON
- 잘못된 YAML Frontmatter
- Unsupported Schema Version

예:

```text
Workspace 검사

✓ Markdown 183개
✓ Database 4개
✓ Schema 정상

⚠ 깨진 Attachment Link 2개
⚠ Schema에 없는 Property 4개
```

---

# 26. IndexedDB 사용 범위

IndexedDB에는 다음 데이터만 저장한다.

- 최근 Workspace
- FileSystemDirectoryHandle
- 최근 열었던 문서
- UI 상태
- Search Index Cache
- 임시 편집 상태

실제 사용자 문서 Content의 Source of Truth로 사용하지 않는다.

---

# 27. UX 원칙

1. Markdown 문법을 몰라도 사용할 수 있어야 한다.
2. 고급 사용자는 Markdown Source를 직접 볼 수 있어야 한다.
3. 사용자 파일 구조를 숨기지 않는다.
4. 앱 내부 데이터와 실제 사용자 Content를 분리한다.
5. 자동화된 변경은 언제든 추적 가능해야 한다.
6. 데이터 손실보다 기능 제한을 우선한다.
7. 파일명 변경과 표시 이름 변경을 안전하게 지원한다.
8. Database 기능 때문에 일반 Markdown 호환성이 깨지지 않아야 한다.

---

# 28. 보안 및 Privacy

- 사용자 문서는 기본적으로 외부 서버로 전송하지 않는다.
- Workspace 접근은 Chrome File System Access API 권한을 사용한다.
- 서버에 Workspace Path나 Document Content를 저장하지 않는다.
- Analytics를 추가할 경우 Document Content를 수집하지 않는다.
- AI 기능 추가 시 어떤 파일이 외부 AI Provider에 전달되는지 명확하게 표시해야 한다.

---

# 29. MVP 범위

## 포함

### Workspace

- Workspace 선택
- 최근 Workspace 기억
- 접근 권한 재승인
- Workspace Scan

### File Manager

- 폴더 생성
- Markdown 생성
- 이름 변경
- 이동
- 삭제

### Editor

- WYSIWYG Markdown Editor
- Markdown Source Mode
- Auto Save
- Table
- Image/Attachment

### Database

- Database 생성
- Item 생성
- Schema 생성
- Property 생성
- Property 이름 변경
- Soft Delete
- Restore

### Property Type

- Text
- Number
- Select
- Multi-select
- Checkbox
- Date

### View

- Table
- Kanban

### Safety

- External Modification Detection
- Basic Undo
- Workspace Version
- Schema Version

### Utility

- Search
- Dark / Light Mode

---

# 30. Post-MVP 후보

우선순위 후보:

1. AI Context Export
2. 여러 View 저장
3. Advanced Filter
4. Advanced Sort
5. Template
6. Workspace Health Check UI 고도화
7. PWA
8. Import / Export
9. Created Time / Modified Time Property
10. Relation
11. Formula
12. Graph View

---

# 31. AI Context Export 방향

Post-MVP에서 다음 기능을 고려한다.

사용자가 여러 문서를 선택한다.

```text
AI Context

☑ Project Overview
☑ Requirements
☑ Architecture
☐ Meeting Notes

[Context 생성]
```

결과:

```markdown
# Project Overview

...

---

# Requirements

...

---

# Architecture

...
```

지원 방식:

- Clipboard 복사
- 하나의 `.md`로 Export

AI Provider 직접 연동은 별도 기능으로 분리한다.

---

# 32. 비기능 요구사항

## Performance

- 수백 개 Markdown 파일 Workspace를 무리 없이 열 수 있어야 한다.
- 초기 Scan 중 UI가 Freeze되지 않아야 한다.
- 대형 Workspace에서는 Lazy Loading을 고려한다.
- Search Index는 Incremental Update 가능해야 한다.

## Reliability

- 파일 저장 중 실패하면 기존 파일을 보호한다.
- 외부 수정된 파일을 임의 overwrite하지 않는다.
- Schema 오류가 발생해도 Markdown 원문은 손상시키지 않는다.

## Portability

Workspace Folder 전체를 Windows와 macOS 사이에서 이동할 수 있어야 한다.

경로는 가능한 상대 경로를 사용한다.

---

# 33. 성공 기준

MVP 성공 여부는 다음 기준으로 판단한다.

1. 신규 사용자가 Chrome에서 5분 이내 Workspace를 열고 첫 Markdown 문서를 작성할 수 있다.
2. Markdown 문법을 직접 입력하지 않고 기본 문서를 작성할 수 있다.
3. 동일 Database를 Table과 Kanban에서 문제 없이 사용할 수 있다.
4. Kanban Card 이동이 실제 Markdown Frontmatter에 반영된다.
5. Property 이름 변경 시 기존 Item 파일을 migration하지 않아도 된다.
6. Property 삭제 후 복원이 가능하다.
7. VS Code에서 수정한 Markdown을 앱에서 다시 정상적으로 읽을 수 있다.