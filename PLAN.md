# PLAN.md — Local-first Markdown Workspace 구현 계획

## 1. 목적

이 문서는 `PRD.md`에서 정의한 Local-first Markdown Workspace를 실제로 구현하기 위한 기술 아키텍처, 개발 순서, 단계별 산출물, 테스트 기준을 정의한다.

핵심 전략은 다음과 같다.

> 처음부터 모든 기능을 만들지 않고,  
> **File System → Markdown → Workspace → Database → View → Safety** 순으로 기반을 쌓는다.

---

# 2. 기술 Stack

## Core

- React
- TypeScript
- Vite

## UI

- Tailwind CSS
- shadcn/ui

## Markdown

- Milkdown
- `yaml`

## State

- Zustand

## Table

- TanStack Table

## Kanban

- dnd-kit

## Search

- MiniSearch 또는 FlexSearch

## Storage / Browser API

- File System Access API
- IndexedDB

## Test

- Vitest
- React Testing Library
- Playwright

## Hosting

초기:

- Cloudflare Pages 또는
- GitHub Pages

요구사항:

- HTTPS
- SPA Routing 지원

---

# 3. 전체 Architecture

```text
┌───────────────────────────────────────────┐
│                  React UI                 │
│                                           │
│ FileTree │ Editor │ Table │ Kanban │ UI   │
└──────────────────────┬────────────────────┘
                       │
                 Application Layer
                       │
       ┌───────────────┼─────────────────┐
       │               │                 │
 WorkspaceService MarkdownService DatabaseService
       │               │                 │
       └───────────────┼─────────────────┘
                       │
                  Domain Layer
                       │
       ┌───────────────┼──────────────────┐
       │               │                  │
 SchemaService     ViewService       SearchService
       │               │                  │
       └───────────────┼──────────────────┘
                       │
                Infrastructure
                       │
       ┌───────────────┼───────────────────┐
       │               │                   │
FileSystemService IndexedDBService BackupService
       │
 File System Access API
       │
   Local Workspace
```

---

# 4. 설계 원칙

## 4.1 UI에서 File API 직접 호출 금지

잘못된 예:

```ts
function Editor() {
  const file = await handle.getFile()
}
```

권장:

```ts
await workspaceService.saveDocument(documentId, content)
```

File System Access API 호출은 `FileSystemService`로 격리한다.

## 4.2 Source of Truth

실제 데이터의 Source of Truth:

```text
Markdown
+
.workspace/*.json
```

다음은 Cache/State일 뿐이다.

```text
Zustand
IndexedDB
Search Index
```

## 4.3 Immutable ID

다음 ID는 생성 후 변경하지 않는다.

- ws_*
- db_*
- item_*
- prop_*
- view_*

## 4.4 사용자 Data와 App Metadata 분리

```text
사용자 Content
→ *.md
→ Attachments/

앱 Metadata
→ .workspace/
```

---

# 5. 권장 Project Structure

```text
src/
│
├─ app/
│  ├─ App.tsx
│  └─ routes/
│
├─ components/
│  ├─ editor/
│  ├─ file-tree/
│  ├─ database/
│  ├─ table/
│  ├─ kanban/
│  └─ common/
│
├─ features/
│  ├─ workspace/
│  ├─ documents/
│  ├─ database/
│  ├─ schema/
│  ├─ views/
│  ├─ search/
│  └─ settings/
│
├─ services/
│  ├─ file-system.service.ts
│  ├─ workspace.service.ts
│  ├─ markdown.service.ts
│  ├─ database.service.ts
│  ├─ schema.service.ts
│  ├─ view.service.ts
│  ├─ search.service.ts
│  ├─ backup.service.ts
│  └─ migration.service.ts
│
├─ stores/
│  ├─ workspace.store.ts
│  ├─ editor.store.ts
│  └─ ui.store.ts
│
├─ domain/
│  ├─ workspace.ts
│  ├─ document.ts
│  ├─ database.ts
│  ├─ property.ts
│  └─ view.ts
│
├─ utils/
│  ├─ id.ts
│  ├─ frontmatter.ts
│  ├─ path.ts
│  └─ validation.ts
│
└─ tests/
```

---

# 6. Data Model

## 6.1 Workspace

```ts
interface WorkspaceConfig {
  workspaceVersion: number
  id: string
  name: string
}
```

## 6.2 Database

```ts
interface DatabaseSchema {
  schemaVersion: number
  id: string
  name: string
  properties: Record<string, PropertyDefinition>
}
```

## 6.3 Property

```ts
type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "checkbox"
  | "date"

interface PropertyDefinition {
  id: string
  name: string
  type: PropertyType
  deleted: boolean
  options?: SelectOption[]
}
```

## 6.4 Select Option

Option에도 ID를 부여하는 것을 권장한다.

```ts
interface SelectOption {
  id: string
  name: string
}
```

이렇게 하면 Option 이름을 변경해도 기존 값을 안전하게 추적할 수 있다.

향후 구현 시 Frontmatter 저장 방식은 다음 두 안 중 선택한다.

### A. 값 저장

```yaml
prop_01: 진행중
```

장점: 사람이 읽기 쉬움

### B. Option ID 저장

```yaml
prop_01: opt_a82f
```

장점: Rename 안전

MVP 권장:

**Select Option ID 저장 + UI에서 Display Name 변환**

Markdown 가독성보다 데이터 안정성을 우선할 경우 이 구조가 적합하다.

## 6.5 View

```ts
interface DatabaseView {
  version: number
  id: string
  databaseId: string
  name: string
  type: "table" | "kanban"
  filter: FilterDefinition[]
  sort: SortDefinition[]
  columnOrder?: string[]
  hiddenProperties?: string[]
  groupBy?: string
}
```

---

# 7. Phase 0 — 개발 환경 준비

## 목표

기본 프로젝트와 품질 도구를 구성한다.

## 작업

- Vite + React + TypeScript 생성
- Tailwind CSS 설정
- shadcn/ui 설정
- ESLint
- Prettier
- Vitest
- Playwright
- Git Repository 생성
- 기본 CI 추가

## 산출물

```text
npm run dev
npm run build
npm run test
```

정상 실행.

## 완료 조건

- Chrome에서 기본 화면 표시
- Production build 성공
- Unit Test 실행 가능
- E2E Test 실행 가능

---

# 8. Phase 1 — File System Foundation

## 목표

Chrome에서 Local Folder를 Workspace로 선택하고 파일을 읽고 쓸 수 있게 한다.

## 구현

### FileSystemService

필수 기능:

```ts
selectDirectory()
readFile()
writeFile()
createFile()
createDirectory()
deleteEntry()
renameEntry()
listDirectory()
getFileMetadata()
```

### Workspace 선택

File System Access API:

```ts
window.showDirectoryPicker()
```

### IndexedDB

DirectoryHandle 저장.

저장 정보:

```text
workspaceId
workspaceName
directoryHandle
lastOpened
```

## 권한 흐름

```text
queryPermission()
↓
granted → Open
prompt → requestPermission()
denied → Permission UI
```

## 완료 조건

- Workspace 선택 가능
- 새 `.md` 파일 생성
- 파일 읽기
- 파일 수정
- 새로고침 후 최근 Workspace 표시
- 권한이 유지된 경우 다시 열기
- 권한이 없으면 재승인 요청

---

# 9. Phase 2 — Workspace Initialization

## 목표

선택한 Folder를 앱 Workspace로 초기화한다.

## 초기 구조

```text
Workspace/
├─ Documents/
├─ Databases/
├─ Attachments/
└─ .workspace/
```

## workspace.json

```json
{
  "workspaceVersion": 1,
  "id": "ws_xxxxxx",
  "name": "Workspace"
}
```

## 구현

WorkspaceService:

```ts
initializeWorkspace()
openWorkspace()
scanWorkspace()
validateWorkspace()
```

## 처리

Folder가 비어 있으면 기본 구조 생성.

기존 Folder인 경우:

- `.workspace` 확인
- 없으면 신규 Workspace로 초기화할지 처리
- 기존 `.md` Scan

## 완료 조건

- 빈 Folder를 Workspace로 초기화 가능
- 기존 Workspace 다시 열기 가능
- `workspace.json` 생성
- Workspace ID 유지

---

# 10. Phase 3 — File Tree

## 목표

Workspace Folder 구조를 UI에서 탐색한다.

## 기능

- Folder Tree
- Expand / Collapse
- Markdown File 표시
- 새 파일
- 새 폴더
- 이름 변경
- 삭제
- Drag & Drop 이동

## 주의

초기에는 모든 File Type을 표시하지 않아도 된다.

MVP:

```text
.md
지원 Attachment
Folder
```

## 완료 조건

File Explorer 없이 앱 내에서 기본 문서 구조 관리 가능.

---

# 11. Phase 4 — Markdown Parser

## 목표

Markdown과 Frontmatter를 안전하게 읽고 저장한다.

## MarkdownService

```ts
parseDocument()
serializeDocument()
parseFrontmatter()
updateFrontmatter()
```

## Frontmatter

`yaml` Package 사용.

예:

```yaml
---
id: item_123
prop_a: value
---
```

## 중요 원칙

Frontmatter 변경 시 Body는 가능한 그대로 보존한다.

Body 변경 시 Frontmatter는 그대로 보존한다.

## Test

- Frontmatter 없는 Markdown
- 빈 Frontmatter
- Unicode
- Korean
- Multiline
- Array
- Boolean
- Date
- Invalid YAML

## 완료 조건

Round-trip Test:

```text
Markdown
→ Parse
→ Serialize
```

후 의미 있는 Content 손실 없음.

---

# 12. Phase 5 — Markdown Editor

## 목표

Markdown 문법을 몰라도 문서를 작성할 수 있게 한다.

## Milkdown 적용

구현 대상:

- Heading
- Bold
- Italic
- Strike
- Lists
- Checkbox
- Link
- Code
- Code Block
- Blockquote
- Table
- Image
- HR

## Mode

```text
Editor
Markdown
```

두 Mode 제공.

## Auto Save

권장:

Debounce 방식.

예:

```text
사용자 입력
↓
800~1500ms
↓
저장
```

## 중요

외부 수정 감지가 구현되기 전에는 aggressive auto save를 피한다.

## 완료 조건

- Markdown 생성
- WYSIWYG 편집
- Source Mode 편집
- 다시 열어도 Content 동일
- 기본 Markdown 호환

---

# 13. Phase 6 — Attachment

## 목표

이미지와 파일을 Workspace 안에서 관리한다.

## 기능

- Drag & Drop
- File Picker
- Clipboard Image Paste

## 처리

```text
Attachment 선택
↓
Attachments/ 저장
↓
Relative Path 생성
↓
Markdown 삽입
```

## 파일명

충돌 방지:

```text
img_<id>.<ext>
file_<id>.<ext>
```

## 완료 조건

Workspace를 다른 Path로 이동해도 Attachment가 정상 표시된다.

---

# 14. Phase 7 — Database Foundation

## 목표

Database 생성과 Item 저장 구조를 구현한다.

## Database 생성

예:

```text
Databases/
└─ Projects/
   └─ items/
```

Schema:

```text
.workspace/schemas/db_xxx.json
```

## DatabaseService

```ts
createDatabase()
loadDatabase()
createItem()
loadItems()
deleteItem()
```

## Item 생성

```markdown
---
id: item_xxx
---

# New Item
```

## 완료 조건

- Database 생성
- Item 생성
- Item 목록 조회
- Item 파일 직접 열기 가능

---

# 15. Phase 8 — Schema Engine

## 목표

Notion-style Property System을 구현한다.

## Property Type

1차:

- Text
- Number
- Select
- Multi-select
- Checkbox
- Date

## Property 생성

```text
사용자: 우선순위
↓
ID 생성: prop_xxx
↓
Schema 저장
```

## Rename

Display Name만 변경.

ID는 유지.

## Soft Delete

```json
"deleted": true
```

Markdown Item 값은 삭제하지 않는다.

## Restore

deleted=false.

## Type 변경

Compatibility validation 필요.

예:

```text
text → number
```

기존 데이터가 숫자로 변환 가능한지 검사.

불가능하면 변경 차단 또는 사용자 경고.

MVP에서는 위험한 Type 변경은 제한해도 된다.

## 완료 조건

Property 추가/수정/삭제/복원 후 Item 데이터가 손상되지 않는다.

---

# 16. Phase 9 — Table View

## 목표

Database Item을 Table 형태로 수정한다.

## TanStack Table

구현:

- Column Rendering
- Sort
- Filter
- Column Order
- Hidden Column
- Row Selection

## Cell Editor

Property별 Component:

```text
TextCell
NumberCell
SelectCell
MultiSelectCell
CheckboxCell
DateCell
```

## 저장 흐름

```text
Cell 수정
↓
DatabaseService.updateProperty()
↓
Markdown Frontmatter 변경
↓
파일 저장
```

## 완료 조건

Table에서 값을 바꾸면 해당 `.md` Frontmatter가 즉시 변경된다.

---

# 17. Phase 10 — Kanban View

## 목표

Select Property 기준 Kanban을 제공한다.

## dnd-kit

구현:

- Column
- Card
- Drag Overlay
- Drop Zone

## Grouping

`groupBy` Property는 Select Type이어야 한다.

## Drag 처리

```text
Card 이동
↓
Property Option 변경
↓
Markdown Frontmatter 수정
↓
Table View에도 반영
```

## 완료 조건

Table ↔ Kanban 간 데이터 불일치가 없어야 한다.

---

# 18. Phase 11 — View Engine

## 목표

Schema와 View를 완전히 분리한다.

## 기능

- View 생성
- View 이름
- Table / Kanban
- Column Order
- Hidden Property
- Group By
- Sort
- Filter

## 저장

```text
.workspace/views/
```

## 완료 조건

같은 Database에서 여러 View 설정을 독립적으로 유지할 수 있다.

MVP UI에서는 View 1~2개만 허용해도 되지만 Data Model은 다중 View를 지원하도록 설계한다.

---

# 19. Phase 12 — External Modification Detection

## 목표

외부 Editor와의 충돌을 방지한다.

## 처리

문서 Open 시:

```text
lastModified 저장
```

저장 전:

```text
현재 File.lastModified 확인
```

다르면:

```text
Conflict
```

## UI

```text
이 문서가 외부에서 변경되었습니다.

[다시 불러오기]
[현재 편집본 유지]
```

MVP에서는 Merge 기능 제외.

## 완료 조건

VS Code에서 수정 후 Web App 저장 시 조용히 overwrite하지 않는다.

---

# 20. Phase 13 — Undo / Backup

## 목표

중요 변경을 되돌릴 수 있게 한다.

## Undo Stack

앱 Session 중:

```text
Document Edit
Property Edit
Kanban Move
```

등을 Command 형태로 관리할 수 있다.

## Backup

다수 File 변경 전에:

```text
.workspace/backup/
```

에 Snapshot.

## MVP 범위

- 최근 Document 변경 Undo
- Kanban Move Undo
- Schema 변경 전 Backup

## 완료 조건
