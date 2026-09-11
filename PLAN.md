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

## Package Manager

- pnpm

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

- MiniSearch

## Storage / Browser API

- File System Access API
- IndexedDB

## Test

- Vitest
- React Testing Library
- Playwright

## Hosting

초기:

- GitHub Actions
- GitHub Pages
- Hash Routing

요구사항:

- HTTPS
- Repository Project Site 하위 경로 지원
- 직접 새로고침 시 404가 발생하지 않는 Routing

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
app/src/
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
  createdAt: string
}
```

## 6.2 Database

```ts
interface DatabaseSchema {
  schemaVersion: number
  id: string
  name: string
  folder: string
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
  order: number
  options?: SelectOption[]
}
```

## 6.4 Select Option

Option에도 immutable ID를 부여한다.

```ts
interface SelectOption {
  id: string
  name: string
}
```

이렇게 하면 Option 이름을 변경해도 기존 값을 안전하게 추적할 수 있다.

Frontmatter에는 Display Name이 아니라 Option ID를 저장한다.

```yaml
prop_01: opt_a82f
```

UI는 Schema를 통해 Option ID를 Display Name으로 변환한다. Option 이름 변경 시 Item Migration을 수행하지 않는다.

## 6.5 View

```ts
interface DatabaseView {
  version: number
  id: string
  databaseId: string
  name: string
  type: "table" | "kanban"
  filters: FilterDefinition[]
  sorts: SortDefinition[]
  propertyOrder: string[]
  hiddenProperties: string[]
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
- GitHub Actions CI 추가
- GitHub Pages 배포 Workflow 추가

## 산출물

다음 명령은 저장소의 `app/` 디렉터리에서 실행한다.

```text
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
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
readTextFile()
writeTextFile()
createDirectory()
moveEntry()
deleteEntry()
listDirectory()
getFileMetadata()
```

`deleteEntry()`는 휴지통 비우기처럼 사용자가 명시적으로 영구 삭제를 요청한 경로에서만 호출한다. 일반 이름 변경, 이동, 삭제는 `moveEntry()` 기반 Application Use Case로 제공한다.

Workspace Root와 `.workspace/` 내부 경로는 일반 File Operation 대상에서 제외하고 Service Layer에서도 차단한다.

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
   └─ trash/
```

## workspace.json

```json
{
  "workspaceVersion": 1,
  "id": "ws_xxxxxx",
  "name": "Workspace",
  "createdAt": "2026-09-09T21:00:00+09:00"
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
- 휴지통으로 이동
- 삭제 항목 복원
- 명시적 휴지통 비우기
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
External Change Guard
↓
저장
```

## 중요

Auto Save를 활성화하기 전에 최소 External Change Guard를 구현한다.

문서를 열 때 기록한 `lastModified`와 저장 직전 Metadata가 다르면 저장을 중단하고, 사용자가 다시 불러오기 또는 현재 편집본으로 덮어쓰기를 선택하도록 한다. 자동 Merge는 하지 않는다.

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

# 16. Phase 8.5 — Preferences / 편집 환경 설정

## 목표

자동 저장처럼 편집 흐름에 직접 영향을 주는 동작을 사용자가 선택할 수 있게 하고, 테마와 기본 편집 모드를 한곳에서 관리한다.

이 Phase는 Table View에 들어가기 전에 공통 설정 기반을 먼저 마련한다. 설정 변경은 문서나 Database Item의 내용을 수정하지 않아야 한다.

## 선행 작업 — UI Foundation Prototype

현재 앱에 바로 Style을 적용하지 않고 `app/public/prototypes/` 아래에 독립된 클릭형 UI Prototype을 먼저 만든다.

상태: **2026-09-11 UI Foundation V1 확정**

실제 앱 반영 상태: **2026-09-11 1차 이관 시작**

- 공통 Design Token과 252px Sidebar, 48px Top Bar를 실제 앱에 연결한다.
- Desktop Sidebar 접기와 좁은 화면 Drawer를 실제 Navigation에 연결한다.
- 기존 문서·Database·파일 Tree 기능을 새 Shell 안에서 그대로 유지한다.
- Settings 진입점은 저장 가능한 환경설정 화면과 함께 다음 이관 묶음에서 추가한다. 동작하지 않는 임시 버튼은 노출하지 않는다.

Prototype에서 다음 구조를 검토한다.

- Sidebar 정보 밀도와 문서 Tree
- 문서 중심 Editor Canvas와 Top Bar
- 문서와 Database 사이의 탐색 흐름
- 설정 진입점과 Dialog 구조
- Light / Dark Theme 방향
- 좁은 화면의 Sidebar Drawer

Prototype은 실제 Workspace 파일을 읽거나 수정하지 않는다. 사용자 검토로 Layout, Navigation, Design Token 방향을 확정한 뒤 공통 Component와 실제 화면에 단계적으로 반영한다.

확정 이후에는 Sidebar, Top Bar, Content Canvas, Settings Dialog의 큰 Layout을 유지한다. Table, Kanban, Search 등 후속 기능은 확정된 구조 안에 추가하며, 전체 Navigation이나 화면 골격을 바꿔야 하는 경우에만 별도 Prototype 검토를 다시 진행한다.

## 설정 진입점

- Desktop Sidebar 하단에 `설정` 버튼을 둔다.
- 좁은 화면에서도 같은 설정 화면에 접근할 수 있어야 한다.
- 설정은 Modal 또는 Side Panel로 제공하되, 현재 편집 문맥을 잃지 않고 닫을 수 있어야 한다.
- 키보드 이동, Focus 표시, Label 연결 등 기본 접근성을 지킨다.

## 설정 항목

### 자동 저장

- `사용` / `사용 안 함`을 선택할 수 있다.
- 자동 저장이 켜져 있을 때 Debounce 간격을 `1초`, `3초`, `5초` 중 선택할 수 있다.
- 초기값은 기존 동작과 같은 `사용`, `1초`로 한다.
- 자동 저장을 꺼도 상단 저장 버튼과 `Ctrl+S` / `Cmd+S` 수동 저장은 항상 제공한다.
- 설정을 끄는 순간 이미 예약된 자동 저장은 취소하되, 작성 중인 내용은 메모리에 유지한다.
- 수동 저장과 자동 저장 모두 Phase 5의 External Change Guard를 동일하게 통과해야 한다.

### 테마

- `시스템 설정`, `라이트`, `다크`를 제공한다.
- 초기값은 `시스템 설정`이다.
- `시스템 설정`에서는 `prefers-color-scheme` 변경을 즉시 반영한다.
- 앱 Shell, File Tree, Editor, Database, Dialog, 상태 표시를 포함한 모든 주요 화면에 같은 테마를 적용한다.
- 페이지를 다시 열 때 잘못된 테마가 잠시 보이는 현상을 최소화한다.

### 키 컬러

- `파랑`, `주황`, `보라`, `검정/흰색`, `커스텀`을 제공한다.
- 초기값은 `파랑`이다.
- 키 컬러는 주요 Button, 선택 상태, Toggle, Focus Ring 등 상호작용 강조에만 사용하며 문서 본문과 전체 배경을 임의로 변경하지 않는다.
- `검정/흰색`은 Light Theme에서 검정, Dark Theme에서 흰색 계열을 사용한다.
- `커스텀`은 Color Picker와 6자리 HEX 입력을 제공하고 유효한 값만 저장한다.
- 선택 색상의 밝기에 따라 Button 글자색을 검정 또는 흰색으로 자동 결정해 대비를 유지한다.

### 문서 글꼴

- 1차로 `Notion 기본`, `Pretendard`, `명조`, `고정폭`을 제공한다.
- 초기값은 운영체제의 UI Font를 우선하는 `Notion 기본`이다.
- Sidebar, Menu, Dialog 등 앱 UI Font는 일관성과 가독성을 위해 고정하고 Editor와 Database Content에만 선택한 글꼴을 적용한다.
- `Pretendard`는 앱에 포함한 Web Font로 운영체제와 관계없이 일관되게 표시한다.
- `Notion 기본`, `명조`, `고정폭`은 운영체제 Font Stack을 사용하므로 기기별 실제 글꼴은 달라질 수 있다.
- 선택한 글꼴은 현재 브라우저에 저장하고 다시 열 때 복원한다.
- 사용자 Font File 추가는 라이선스, 파일 크기, 지원 형식, IndexedDB 저장 정책을 별도로 정한 뒤 후속 범위로 확장한다.

### 기본 편집 모드

- `에디터`와 `Markdown` 중 새로 여는 문서의 기본 모드를 선택한다.
- 초기값은 `에디터`다.
- 이미 열려 있는 문서의 현재 모드는 설정을 바꾸는 즉시 강제로 전환하지 않는다. 다음에 여는 문서부터 적용한다.

## Preference Model

```ts
type ThemePreference = "system" | "light" | "dark"
type AccentPreset = "blue" | "orange" | "purple" | "monochrome" | "custom"
type DocumentFontPreference = "notion" | "pretendard" | "serif" | "mono"
type DefaultEditorMode = "visual" | "source"

interface UserPreferences {
  version: 1
  autosave: {
    enabled: boolean
    delayMs: 1000 | 3000 | 5000
  }
  theme: ThemePreference
  accent: {
    preset: AccentPreset
    customHex: string
  }
  documentFont: DocumentFontPreference
  defaultEditorMode: DefaultEditorMode
}
```

## 저장 위치와 책임

- 환경설정은 브라우저 `localStorage`에 Version이 있는 JSON으로 저장한다.
- 환경설정은 현재 브라우저에만 적용하며 Workspace 파일이나 `.workspace/`에는 기록하지 않는다.
- 환경설정은 Markdown Source of Truth에 포함되지 않으며 Workspace를 이동하거나 공유해도 따라가지 않는다.
- 누락되거나 잘못된 값은 항목별 기본값으로 복구하고 앱 시작을 차단하지 않는다.
- UI Component가 저장소를 직접 읽고 쓰지 않도록 `PreferencesStore`가 Load, Validation, Update, Persist를 담당한다.

## 미저장 변경 보호

자동 저장이 꺼져 있고 변경사항이 있으면 명확한 `저장 안 됨` 상태를 표시한다.

앱 안에서 다른 문서나 화면으로 이동할 때는 다음 선택지를 제공한다.

```text
[저장하고 이동]
[저장하지 않고 이동]
[취소]
```

- `저장하고 이동`은 저장 성공 후에만 이동한다.
- 충돌이나 파일 쓰기 실패가 발생하면 현재 화면과 편집 내용을 유지한다.
- `저장하지 않고 이동`은 해당 문서의 메모리 Draft만 폐기하며 디스크 파일은 수정하지 않는다.
- Browser 새로고침, Tab 닫기, 창 닫기에는 `beforeunload` 경고를 사용한다.
- 자동 저장이 켜져 있어도 아직 Debounce 대기 중이거나 저장 실패 상태라면 같은 보호 규칙을 적용한다.

## 구현 순서

1. 독립 UI Prototype을 만들고 Layout, Navigation, Theme 방향을 확정한다.
2. 확정한 Design Token과 공통 UI 뼈대를 실제 앱에 반영한다.
3. Preference Model, 기본값, Validation, 영속화 Store를 구현한다.
4. 설정 진입점과 설정 화면을 추가한다.
5. 기존 1초 고정 자동 저장을 Preference 기반 동작으로 교체한다.
6. 수동 저장 단축키와 미저장 이동 보호를 연결한다.
7. Theme 적용과 시스템 테마 변경 감지를 연결한다.
8. 기본 편집 모드를 문서 Open 흐름에 연결한다.
9. Unit, Integration, E2E, 실제 Chrome 시각 검증을 수행한다.

## Test

### Unit / Integration

- 저장된 설정이 없을 때 기본값 사용
- 올바른 설정 저장 및 재실행 후 복원
- 일부 필드 누락, 잘못된 값, 미래 Version 입력 시 안전한 복구
- 자동 저장 Off에서 Debounce 저장 미실행
- 자동 저장 On에서 선택한 간격 후 한 번만 저장
- 설정 변경 시 대기 중인 자동 저장 취소 및 새 간격 적용
- `Ctrl+S` / `Cmd+S` 수동 저장
- 수동/자동 저장 모두 외부 수정 충돌 차단
- 기본 편집 모드가 다음에 여는 문서부터 적용
- 시스템 테마 변경 감지와 Listener 정리
- 키 컬러 Preset 및 Custom HEX Validation
- Custom 키 컬러 저장 후 재실행 시 복원
- 키 컬러별 Button 전경색 대비 결정
- 문서 글꼴 변경 시 Editor와 Database Content에만 적용
- 저장한 문서 글꼴 재실행 시 복원

### E2E / Manual Browser Test

- 설정 화면을 열고 모든 항목 변경 가능
- 자동 저장 Off 상태에서 입력 후 파일이 자동 변경되지 않음
- 저장 버튼 또는 단축키 사용 후 파일 변경
- 미저장 상태에서 문서 이동 시 저장, 폐기, 취소 흐름 확인
- 새로고침 후 설정 유지
- 라이트/다크 테마에서 주요 화면의 가독성과 Focus 상태 확인
- 각 Theme와 키 컬러 조합에서 Button, Toggle, 선택 상태 확인
- 각 문서 글꼴에서 한글, 영문, 숫자, Markdown Code 표시 확인
- Desktop과 좁은 화면 모두에서 설정 접근 가능

## 제외 범위

- Workspace별 설정
- 기기 간 설정 동기화
- 배경과 본문까지 변경하는 완전한 사용자 정의 Theme
- 사용자 Font File 업로드 및 외부 Font URL 입력
- 자동 저장 간격의 임의 숫자 입력
- 여러 문서 Draft의 장기 복구

## 완료 조건

- 사용자가 자동 저장을 끄고 명시적으로 저장하며 편집할 수 있다.
- 자동 저장 간격, Theme, 키 컬러, 문서 글꼴, 기본 편집 모드가 재실행 후에도 유지된다.
- 미저장 변경이 사용자 확인 없이 사라지지 않는다.
- 설정 변경이 Markdown 및 `.workspace/` 파일을 불필요하게 수정하지 않는다.
- 모든 저장 경로에서 외부 변경 충돌과 쓰기 실패를 안전하게 처리한다.
- 라이트/다크 Theme에서 편집기와 주요 화면이 일관되게 표시된다.

---

# 17. Phase 9 — Table View

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

# 18. Phase 10 — Kanban View

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

# 19. Phase 11 — View Engine

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

# 20. Phase 12 — External Modification Detection 고도화

## 목표

Phase 5 전에 도입한 최소 External Change Guard를 모든 문서 및 Database 저장 흐름에 일관되게 적용하고 충돌 UX를 고도화한다.

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

현재 편집본 유지는 사용자의 명시적 확인 후 최신 Metadata를 기준으로 덮어쓴다.

## 완료 조건

- VS Code에서 수정 후 Web App 저장 시 조용히 overwrite하지 않는다.
- 일반 Document, Table Cell, Kanban Card 저장이 동일한 Conflict 판정을 사용한다.
- 명시적 강제 저장 전에는 외부 변경 파일을 수정하지 않는다.

---

# 21. Phase 13 — Undo / Backup / Trash

## 목표

중요 변경을 되돌리고 삭제한 파일을 복원할 수 있게 한다.

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

에 Snapshot을 생성한다.

## Trash

일반 파일과 폴더 삭제는 `.workspace/trash/`로 이동하고 원래 Workspace 상대 경로와 삭제 시각을 기록한다.

영구 삭제는 사용자가 휴지통 비우기를 명시적으로 실행한 경우에만 수행하며 자동 보존 기간 만료는 두지 않는다.

## MVP 범위

- 최근 Document 변경 Undo
- Kanban Move Undo
- Schema 변경 전 Backup
- 휴지통 이동과 복원
- 명시적 휴지통 비우기

## 완료 조건

- Session Undo로 최근 Document 변경과 Kanban 이동을 되돌릴 수 있다.
- Schema 변경 전에 복구 가능한 Snapshot이 생성된다.
- 실패한 Batch Operation이 성공으로 표시되지 않는다.
- 휴지통 이동 시 원래 상대 경로와 삭제 시각이 보존된다.
- 휴지통에서 복원할 수 있고, 영구 삭제는 명시적 휴지통 비우기로만 가능하다.

---

# 22. Phase 14 — Search

## 목표

Workspace의 Markdown을 Source of Truth로 유지하면서 검색 가능한 파생 Index를 제공한다.

## 구현

- 파일명, 첫 H1, Markdown 본문, Database Property 값 검색
- 문서 변경 시 Incremental Reindex
- Index Version 불일치 또는 손상 시 전체 재생성
- 초기 Scan에서 Markdown Body Lazy Loading

## 완료 조건

- Index를 삭제해도 Workspace 원본에서 재생성할 수 있다.
- 외부에서 추가·수정·삭제한 파일이 재 Scan 후 검색 결과에 반영된다.
- 수백 개 Markdown 파일을 Scan하는 동안 UI가 장시간 멈추지 않는다.

---

# 23. Phase 15 — Health Check / Migration

## 목표

Workspace 손상을 조기에 탐지하고 Version 변경을 안전하게 수행한다.

## Health Check

- 잘못된 JSON/YAML
- 중복 Workspace, Database, Item ID
- 존재하지 않는 Property/Option 참조
- Schema/View 누락 또는 지원하지 않는 Version
- 깨진 Attachment Link
- 복원할 수 없는 휴지통 Metadata

## Migration

1. 대상 Version과 Migration 경로를 검증한다.
2. 변경 전 `.workspace/backup/`에 Snapshot을 생성한다.
3. Version을 한 단계씩 순차 변경한다.
4. 각 단계 결과를 Validation한다.
5. 실패 시 기존 원본을 유지하고 오류를 보고한다.

## 완료 조건

- 오류가 있는 Workspace를 열어도 원본을 임의 수정하지 않는다.
- Migration Fixture로 이전 Version부터 최신 Version까지 순차 변환을 검증한다.
- 중간 Version 누락과 미래 Version은 안전하게 차단한다.

---

# 24. Phase 16 — QA / Release

## 테스트 전략

### Unit Test

- ID, Path, Validation 같은 Domain Utility
- Markdown/Frontmatter Round-trip
- Schema, Property, View Validation
- Migration과 Conflict 판정

### Integration Test

- Browser API와 분리된 In-memory FileSystem Adapter 사용
- Workspace 초기화, 문서 저장, 휴지통 이동/복원
- Database Item과 Schema/View 연동
- 외부 수정 충돌과 Backup 실패 경로

### E2E / Manual Browser Test

- Playwright로 Browser API 외 UI 흐름 자동화
- 실제 Chrome에서 Folder Picker와 Permission 흐름 수동 검증
- Windows/macOS에서 상대 경로 및 Attachment 이동성 검증

## CI

Pull Request와 `main` Push에서 `app/`을 작업 디렉터리로 사용해 다음을 실행한다.

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

`main`의 CI가 성공한 경우에만 GitHub Pages 배포 Workflow를 실행한다.

## Release 기준

- Lint, Unit, Integration, E2E Test 통과
- Production Build 성공
- GitHub Pages Project Site에서 Hash Routing 동작
- Chrome 최신 버전에서 File System 권한 흐름 수동 확인
- PRD 성공 기준의 핵심 흐름 통과
- 알려진 데이터 손실 가능성이 없음
- Workspace/Schema/View Version과 Migration 문서가 현재 구현과 일치

## 완료 조건

- 새 Checkout에서 pnpm 명령만으로 설치·검증·빌드할 수 있다.
- GitHub Actions가 동일한 검증을 재현한다.
- 배포 URL에서 첫 Workspace 선택 화면이 표시된다.
- 실패한 검증이 있는 Commit은 배포되지 않는다.
