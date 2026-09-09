# ARCHITECTURE.md — Local-first Markdown Workspace

## 1. 목적

이 문서는 Local-first Markdown Workspace의 시스템 구조, Layer별 책임, 데이터 흐름, 파일 저장 정책을 정의한다.

이 문서는 구현 중 Architecture가 임의로 변경되는 것을 방지하기 위한 기준 문서다.

---

# 2. Architecture 목표

시스템은 다음 조건을 만족해야 한다.

1. 사용자 Content는 Local File System에 저장한다.
2. UI와 File System Access를 분리한다.
3. Markdown, Schema, View를 서로 다른 책임으로 관리한다.
4. IndexedDB는 Cache와 Browser Handle 저장 용도로만 사용한다.
5. 파일을 외부 Editor에서 수정해도 최대한 안전하게 동작한다.
6. 향후 Migration과 기능 확장이 가능해야 한다.
7. 앱이 없어져도 Markdown 파일 자체는 독립적으로 사용할 수 있어야 한다.

---

# 3. High-level Architecture

```text
┌────────────────────────────────────────────┐
│                  React UI                  │
│                                            │
│ File Tree │ Editor │ Table │ Kanban │ UX  │
└──────────────────────┬─────────────────────┘
                       │
               Application Layer
                       │
     ┌─────────────────┼──────────────────┐
     │                 │                  │
WorkspaceService  DocumentService   DatabaseService
     │                 │                  │
     └─────────────────┼──────────────────┘
                       │
                  Domain Layer
                       │
     ┌─────────────────┼──────────────────┐
     │                 │                  │
SchemaService     ViewService       SearchService
     │                 │                  │
     └─────────────────┼──────────────────┘
                       │
              Infrastructure Layer
                       │
     ┌─────────────────┼──────────────────┐
     │                 │                  │
FileSystemService IndexedDBService BackupService
     │
File System Access API
     │
Local Workspace
```

---

# 4. Layer 정의

## 4.1 Presentation Layer

React Component와 사용자 Interaction을 담당한다.

예:

- Sidebar
- File Tree
- Markdown Editor
- Table View
- Kanban View
- Settings
- Dialog
- Toast
- Search UI

원칙:

> Presentation Layer는 `FileSystemDirectoryHandle`이나 `FileSystemFileHandle`을 직접 다루지 않는다.

잘못된 예:

```ts
const file = await handle.getFile()
```

권장:

```ts
await documentService.openDocument(documentId)
```

---

## 4.2 Application Layer

사용자의 행동을 하나의 Use Case로 구성한다.

주요 Service:

```text
WorkspaceService
DocumentService
DatabaseService
```

예:

```ts
workspaceService.openWorkspace()
documentService.saveDocument()
databaseService.updateProperty()
databaseService.moveKanbanItem()
```

Application Layer는 Domain과 Infrastructure를 조합한다.

---

## 4.3 Domain Layer

제품의 핵심 규칙을 담당한다.

주요 영역:

```text
Workspace
Document
Database
Schema
Property
View
```

Domain Layer는 Browser API에 의존하지 않는 것을 원칙으로 한다.

예:

```ts
validatePropertyValue()
createPropertyId()
applySchemaChange()
validateView()
```

---

## 4.4 Infrastructure Layer

Browser 및 실제 저장소와의 연결을 담당한다.

주요 구성:

- FileSystemService
- IndexedDBService
- BackupService
- Search Index Adapter

---

# 5. 핵심 Service 책임

## 5.1 FileSystemService

File System Access API를 감싼다.

책임:

```text
Folder 선택
Directory Scan
File 읽기
File 쓰기
File 생성
Folder 생성
휴지통 이동
휴지통 복원
명시적 영구 삭제
Metadata 조회
Permission 확인
```

예상 Interface:

```ts
interface FileSystemService {
  selectDirectory(): Promise<FileSystemDirectoryHandle>
  readTextFile(path: string): Promise<string>
  writeTextFile(path: string, content: string): Promise<void>
  createDirectory(path: string): Promise<void>
  moveEntry(sourcePath: string, destinationPath: string): Promise<void>
  deleteEntry(path: string): Promise<void>
  listDirectory(path: string): Promise<FileEntry[]>
  getMetadata(path: string): Promise<FileMetadata>
}
```

---

## 5.2 WorkspaceService

Workspace Lifecycle을 담당한다.

책임:

```text
Workspace 초기화
Workspace 열기
최근 Workspace 복원
Workspace Scan
Workspace Version 확인
Health Check 호출
```

---

## 5.3 DocumentService

일반 Markdown Document를 관리한다.

책임:

```text
Document 생성
읽기
저장
이름 변경
이동
휴지통 이동
휴지통 복원
Attachment 연결
External Change Detection
```

---

## 5.4 MarkdownService

Markdown과 Frontmatter 변환을 담당한다.

책임:

```text
Markdown Parse
Markdown Serialize
Frontmatter Parse
Frontmatter Update
Body 보존
Unsupported Syntax Validation
```

원칙:

> Frontmatter 변경 때문에 Body가 재포맷되지 않아야 한다.

---

## 5.5 DatabaseService

Markdown Item과 Database Operation을 담당한다.

책임:

```text
Database 생성
Item 생성
Item 목록 읽기
Property 값 변경
Kanban 상태 이동
Row 삭제
```

---

## 5.6 SchemaService

Database Property 구조를 관리한다.

책임:

```text
Property 생성
Property Rename
Property Soft Delete
Property Restore
Property Type Validation
Select Option 관리
```

---

## 5.7 ViewService

Database View 설정을 관리한다.

책임:

```text
Table View 설정
Kanban View 설정
Column Order
Hidden Property
Sort
Filter
Group By
```

---

# 6. Workspace 저장 구조

```text
MyWorkspace/
│
├─ Documents/
│
├─ Databases/
│  └─ Projects/
│     └─ items/
│
├─ Attachments/
│
└─ .workspace/
   ├─ workspace.json
   ├─ schemas/
   ├─ views/
   ├─ cache/
   ├─ backup/
   └─ trash/
```

---

# 7. Source of Truth

## 사용자 Content

```text
*.md
Attachments/*
```

## App Metadata

```text
.workspace/workspace.json
.workspace/schemas/*.json
.workspace/views/*.json
```

## Cache

```text
IndexedDB
.workspace/cache/
```

Cache는 언제든 재생성 가능해야 한다.

---

# 8. 저장 흐름

## 일반 문서 저장

```text
Editor
↓
DocumentService
↓
External Change Check
↓
MarkdownService
↓
FileSystemService
↓
.md
```

## Table Cell 수정

```text
Table Cell
↓
DatabaseService.updateProperty()
↓
MarkdownService.updateFrontmatter()
↓
External Change Check
↓
FileSystemService.write()
↓
item.md
```

## Kanban 이동

```text
Card Drag
↓
View의 groupBy Property 확인
↓
DatabaseService.updateProperty()
↓
Frontmatter 변경
↓
item.md 저장
```

---

# 9. Browser Storage 정책

IndexedDB 저장 대상:

```text
DirectoryHandle
최근 Workspace
최근 문서
UI Preference
Search Index Cache
Temporary Draft
```

저장 금지:

```text
사용자 Markdown의 유일한 원본
Database의 유일한 원본
Schema의 유일한 원본
```

---

# 10. External Change Detection

최소 External Change Guard는 Editor Auto Save를 활성화하기 전에 구현한다. 이후 모든 저장 경로가 동일한 Guard를 사용하도록 Application Layer에서 공통화한다.

문서를 열 때:

```text
path
lastModified
content hash(optional)
```

를 저장한다.

저장 직전 실제 File Metadata를 다시 확인한다.

```text
동일
→ 저장

변경됨
→ Conflict
```

MVP 처리:

```text
다시 불러오기
현재 편집본 유지
```

자동 Merge는 Post-MVP다.

`현재 편집본 유지`는 묵시적 overwrite가 아니라 사용자가 충돌 사실을 확인한 뒤 수행하는 명시적 강제 저장이다.

---

# 11. Atomic Write 전략

가능한 경우 다음 흐름을 사용한다.

```text
현재 파일 확인
↓
Backup 필요 여부 판단
↓
Write
↓
Write 성공 확인
↓
State Update
```

여러 파일을 일괄 수정하는 경우:

```text
Snapshot
↓
Batch Operation
↓
Validation
↓
Success
```

실패 시 가능한 범위에서 Rollback한다.

File System Access API에서 직접 Move를 사용할 수 없는 경우 파일 또는 폴더를 대상 위치에 복사하고, 크기 및 필요한 경우 Content Hash로 복사 성공을 검증한 뒤 원본을 제거한다. 복사나 검증이 실패하면 원본을 유지한다.

휴지통 이동도 동일한 순서를 사용하며, 복구 Metadata 저장과 Payload 검증이 모두 성공하기 전에는 원본을 제거하지 않는다.

Workspace Root와 `.workspace/` 내부 경로는 일반 File Operation으로 이동하거나 삭제할 수 없도록 Application Layer와 Infrastructure Layer 양쪽에서 검증한다.

---

# 12. ID 정책

모든 주요 Entity는 immutable ID를 가진다.

```text
ws_
db_
item_
prop_
view_
opt_
```

예:

```text
ws_d91f32
db_a82c10
item_73af90
prop_b83d11
view_a12f11
opt_82bd00
```

Display Name은 ID와 독립적으로 변경 가능하다.

---

# 13. Data / Schema / View 분리

```text
Markdown
= Value

Schema
= Structure

View
= Presentation
```

예:

```text
item.md
prop_a = opt_1

schema.json
prop_a = 상태
opt_1 = 진행중

view.json
groupBy = prop_a
```

---

# 14. Markdown Compatibility

지원하지 않는 Syntax가 들어와도 가능한 원문을 보존한다.

Source Mode를 항상 제공한다.

Markdown Parser/Serializer는 Round-trip Test를 수행한다.

```text
parse
→ edit
→ serialize
```

시 의미 없는 전체 재포맷을 최소화한다.

---

# 15. Attachment Architecture

Attachment는 Workspace 내부에 저장한다.

```text
Attachments/
```

Markdown에서는 상대 경로를 사용한다.

```markdown
![image](../Attachments/img_a82f.png)
```

Attachment의 실제 경로를 앱 Database에만 숨겨 저장하지 않는다.

---

# 16. Search Architecture

Search Index는 파생 데이터다.

```text
Markdown
↓
Indexer
↓
Search Index
```

문서 저장 시 변경된 문서만 Reindex한다.

Workspace Scan 시 Index가 없거나 버전이 다르면 재생성한다.

---

# 17. Backup Architecture

Backup은 다음 Operation 위주로 생성한다.

- Schema 구조 변경
- Batch Update
- Migration
- 위험한 Property Type 변경

위치:

```text
.workspace/backup/
```

단순 입력마다 Snapshot을 생성하지 않는다.

일반 파일 삭제는 Backup과 별도로 `.workspace/trash/`에 원본을 이동한다. 원래 상대 경로와 삭제 시각을 함께 기록하며 자동 영구 삭제는 하지 않는다.

---

# 18. Migration Architecture

각 구조에 Version을 둔다.

```text
workspaceVersion
schemaVersion
viewVersion
```

예:

```text
v1
↓
MigrationService
↓
v2
```

원칙:

1. Migration 전 Backup
2. Migration은 순차 실행
3. 중간 Version 건너뛰기 금지
4. 실패 시 기존 원본 유지
5. Migration Test Fixture 유지

---

# 19. Error Handling

Error Category:

```text
PermissionError
FileNotFoundError
FileConflictError
InvalidMarkdownError
InvalidFrontmatterError
InvalidSchemaError
MigrationError
WorkspaceCorruptionError
```

사용자 메시지는 기술 Error 그대로 노출하지 않는다.

---

# 20. Security

- Raw HTML은 초기에는 제한
- Markdown Preview XSS 방어
- `javascript:` URL 차단
- Attachment MIME 확인
- 사용자 Content를 Analytics에 전송하지 않음
- Console Log에 문서 전체 내용 출력 금지

---

# 21. 성능 원칙

Workspace 전체 Markdown Body를 최초 실행 시 모두 읽지 않는다.

```text
Folder Scan
↓
Metadata
↓
필요한 File만 Read
```

대형 Workspace에서는:

- Lazy Loading
- Incremental Search Index
- Web Worker

를 고려한다.

---

# 22. 확장 포인트

Architecture는 다음 기능을 나중에 추가할 수 있어야 한다.

- AI Context Export
- Template
- Relation
- Formula
- Saved View
- PWA
- Import / Export

단, MVP 구현 시 해당 기능을 미리 구현하지 않는다.

---

# 23. Architecture 금지사항

다음 패턴은 피한다.

1. React Component에서 직접 File API 호출
2. IndexedDB를 실제 문서 원본으로 사용
3. Property Rename 시 모든 Markdown Key Migration
4. Schema와 View를 하나의 파일에 강하게 결합
5. Attachment를 Base64로 Markdown 안에 저장
6. 사용자의 Markdown을 앱 전용 Format으로 변환
7. 외부 수정 확인 없이 Auto Save로 덮어쓰기

---

# 24. Deployment Architecture

MVP는 GitHub Actions에서 검증과 Production Build를 수행한 뒤 GitHub Pages에 배포한다.

Repository Project Site의 하위 경로를 Build Base Path에 반영하고, Client Routing은 Hash Routing을 사용한다.

GitHub Actions의 실행 디렉터리는 `app/`, Pages에 업로드하는 Build Artifact는 `app/dist/`로 고정한다.

배포 조건:

1. `pnpm install --frozen-lockfile` 성공
2. Lint, Test, Production Build 성공
3. E2E Test 성공
4. `main` Branch의 검증된 Artifact만 배포
