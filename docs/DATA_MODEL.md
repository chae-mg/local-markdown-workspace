# DATA_MODEL.md — Local-first Markdown Workspace

## 1. 목적

이 문서는 Local-first Markdown Workspace에서 사용하는 데이터 모델과 ID, 저장 포맷, Entity 간 관계를 정의한다.

---

# 2. 핵심 모델

```text
Workspace
│
├─ Document
│
└─ Database
   │
   ├─ Schema
   │  └─ Property
   │     └─ SelectOption
   │
   ├─ Item
   │
   └─ View
```

---

# 3. 공통 ID 규칙

모든 내부 ID는 생성 이후 변경하지 않는다.

| Entity | Prefix | 예시 |
|---|---|---|
| Workspace | `ws_` | `ws_a83f21` |
| Database | `db_` | `db_a82c90` |
| Item | `item_` | `item_83af11` |
| Property | `prop_` | `prop_7f3a91` |
| View | `view_` | `view_8f2c19` |
| Select Option | `opt_` | `opt_a93b21` |

ID는 Display Name과 무관하다.

---

# 4. Workspace

## 저장 파일

```text
.workspace/workspace.json
```

## Model

```ts
interface WorkspaceConfig {
  workspaceVersion: number
  id: string
  name: string
  createdAt: string
}
```

## 예

```json
{
  "workspaceVersion": 1,
  "id": "ws_a912cd",
  "name": "회사 업무",
  "createdAt": "2026-09-09T21:00:00+09:00"
}
```

---

# 5. 일반 Document

일반 Document는 별도 앱 ID가 없어도 사용할 수 있다.

기본 식별자는 Workspace 상대 경로다.

예:

```text
Documents/업무가이드.md
```

향후 문서 간 안정적인 Link가 필요하면 Frontmatter에 Document ID를 선택적으로 추가할 수 있다.

MVP에서는 일반 문서에 ID를 강제하지 않는다.

---

# 6. Database

## 실제 Item 위치

```text
Databases/<database-folder>/items/
```

## Schema 위치

```text
.workspace/schemas/<database-id>.json
```

## View 위치

```text
.workspace/views/<view-id>.json
```

## Model

```ts
interface DatabaseSchema {
  schemaVersion: number
  id: string
  name: string
  folder: string
  properties: Record<PropertyId, PropertyDefinition>
}
```

## 예

```json
{
  "schemaVersion": 1,
  "id": "db_a82c90",
  "name": "프로젝트",
  "folder": "Databases/Projects/items",
  "properties": {}
}
```

---

# 7. Item

Database Item 1개는 Markdown File 1개다.

## 예

```markdown
---
id: item_a83f21
prop_status: opt_progress
prop_priority: opt_high
prop_due: 2026-09-30
prop_done: false
---

# Dashboard 개선

Dashboard Filter 기능을 개선한다.
```

## Item Model

```ts
interface DatabaseItem {
  id: string
  path: string
  title: string
  properties: Record<string, unknown>
  body: string
  lastModified: number
}
```

---

# 8. Property

## Supported Type

```ts
type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "checkbox"
  | "date"
```

## Base Model

```ts
interface BaseProperty {
  id: string
  name: string
  type: PropertyType
  deleted: boolean
  order: number
}
```

---

# 9. Text Property

```ts
interface TextProperty extends BaseProperty {
  type: "text"
}
```

Frontmatter:

```yaml
prop_xxx: "Dashboard"
```

---

# 10. Number Property

```ts
interface NumberProperty extends BaseProperty {
  type: "number"
}
```

Frontmatter:

```yaml
prop_xxx: 85
```

빈 값은 Property 자체를 생략하거나 `null`로 표현할 수 있다.

MVP 권장:

> 빈 값은 Frontmatter Key를 생략한다.

---

# 11. Checkbox Property

```ts
interface CheckboxProperty extends BaseProperty {
  type: "checkbox"
}
```

Frontmatter:

```yaml
prop_xxx: true
```

---

# 12. Date Property

```ts
interface DateProperty extends BaseProperty {
  type: "date"
}
```

날짜만:

```yaml
prop_xxx: "2026-09-30"
```

MVP에서는 시간 범위 및 Date Range를 지원하지 않는다.

---

# 13. Select Property

## Schema

```ts
interface SelectProperty extends BaseProperty {
  type: "select"
  options: SelectOption[]
}
```

## Option

```ts
interface SelectOption {
  id: string
  name: string
  deleted?: boolean
}
```

## 예

```json
{
  "id": "prop_status",
  "name": "상태",
  "type": "select",
  "deleted": false,
  "order": 1,
  "options": [
    {
      "id": "opt_todo",
      "name": "예정"
    },
    {
      "id": "opt_progress",
      "name": "진행중"
    },
    {
      "id": "opt_done",
      "name": "완료"
    }
  ]
}
```

Frontmatter에는 Option ID를 저장한다.

```yaml
prop_status: opt_progress
```

장점:

```text
진행중
→ 작업중
```

으로 이름을 바꿔도 Item Migration이 필요 없다.

---

# 14. Multi-select Property

Schema:

```ts
interface MultiSelectProperty extends BaseProperty {
  type: "multi_select"
  options: SelectOption[]
}
```

Frontmatter:

```yaml
prop_tags:
  - opt_ai
  - opt_data
```

---

# 15. Property 이름 변경

기존:

```json
{
  "id": "prop_01",
  "name": "우선순위"
}
```

변경:

```json
{
  "id": "prop_01",
  "name": "중요도"
}
```

Markdown은 변경하지 않는다.

---

# 16. Property 삭제

Physical Delete는 지원하지 않는다.

```json
{
  "id": "prop_01",
  "name": "우선순위",
  "deleted": true
}
```

Item 값:

```yaml
prop_01: opt_high
```

은 유지한다.

---

# 17. Select Option 삭제

Property와 동일하게 Soft Delete 방식 권장.

```json
{
  "id": "opt_high",
  "name": "높음",
  "deleted": true
}
```

기존 Item이 해당 Option을 참조해도 값은 유지한다.

UI에서는:

```text
높음 (삭제됨)
```

처럼 표시 가능하다.

---

# 18. View

## Model

```ts
interface DatabaseView {
  version: number
  id: string
  databaseId: string
  name: string
  type: "table" | "kanban"
  filters: FilterDefinition[]
  sorts: SortDefinition[]
  hiddenProperties: string[]
  propertyOrder: string[]
  groupBy?: string
}
```

## Table View 예

```json
{
  "version": 1,
  "id": "view_table_default",
  "databaseId": "db_a82c90",
  "name": "전체 프로젝트",
  "type": "table",
  "filters": [],
  "sorts": [],
  "hiddenProperties": [],
  "propertyOrder": [
    "prop_status",
    "prop_priority",
    "prop_due"
  ]
}
```

## Kanban View 예

```json
{
  "version": 1,
  "id": "view_status",
  "databaseId": "db_a82c90",
  "name": "상태별",
  "type": "kanban",
  "groupBy": "prop_status",
  "filters": [],
  "sorts": [],
  "hiddenProperties": [],
  "propertyOrder": []
}
```

---

# 19. Filter Model

MVP 예시:

```ts
interface FilterDefinition {
  propertyId: string
  operator: string
  value: unknown
}
```

초기 Operator:

Text:

```text
equals
contains
is_empty
is_not_empty
```

Number:

```text
equals
gt
gte
lt
lte
```

Select:

```text
equals
not_equals
```

Checkbox:

```text
is_true
is_false
```

Date:

```text
equals
before
after
```

---

# 20. Sort Model

```ts
interface SortDefinition {
  propertyId: string
  direction: "asc" | "desc"
}
```

---

# 21. Title 정책

Database Item의 제목은 Markdown H1을 기본으로 사용한다.

예:

```markdown
# Dashboard 개선
```

Item Frontmatter에 별도 `title` Property를 강제하지 않는다.

이유:

- Markdown 가독성 유지
- 일반 Editor와 호환
- Content 중복 최소화

향후 필요하면 Title Property를 내부 Special Property로 추가할 수 있다.

---

# 22. File Name 정책

파일명은 Title과 분리한다.

예:

```text
파일:
dashboard-improvement.md

Title:
Dashboard 개선
```

파일명을 바꿔도 Item ID는 유지된다.

---

# 23. 빈 값 정책

빈 Property 값은 Frontmatter에서 Key를 생략하는 것을 기본으로 한다.

예:

```yaml
---
id: item_a83f21
prop_status: opt_progress
---
```

`prop_due` 값이 없다면 작성하지 않는다.

이 방식은 Markdown을 비교적 깔끔하게 유지한다.

---

# 24. Unknown Property 처리

Markdown Item:

```yaml
prop_unknown: value
```

Schema에 해당 Property가 없는 경우 데이터를 삭제하지 않는다.

Health Check에서 Warning으로 표시한다.

```text
Unknown Property: prop_unknown
```

---

# 25. Invalid Option 처리

Item:

```yaml
prop_status: opt_missing
```

Schema에 Option이 없으면 값을 그대로 유지한다.

UI:

```text
알 수 없는 값
```

Health Check Warning 대상이다.

---

# 26. Schema Version

```json
{
  "schemaVersion": 1
}
```

Schema 구조가 바뀌면 Version을 증가시킨다.

---

# 27. View Version

```json
{
  "version": 1
}
```

View 구조 변경 시 Migration 대상으로 사용한다.

---

# 28. File Metadata

Runtime에서는 다음 Metadata를 관리할 수 있다.

```ts
interface FileMetadata {
  path: string
  size: number
  lastModified: number
}
```

이 값은 외부 수정 감지에 사용한다.

---

# 29. Attachment Model

Attachment는 별도 Database가 아니라 File로 관리한다.

```text
Attachments/
```

필요 시 Runtime Metadata:

```ts
interface AttachmentMetadata {
  path: string
  mimeType: string
  size: number
}
```

Source of Truth는 실제 File이다.

---

# 30. 관계 요약

```text
Workspace
│
├─ Documents/*.md
│
├─ Databases/
│  └─ <Database>/
│     └─ items/*.md
│
├─ Attachments/*
│
└─ .workspace/
   ├─ workspace.json
   ├─ schemas/
   │  └─ <Database ID>.json
   └─ views/
      └─ <View ID>.json
```

---

# 31. Data Safety 규칙

1. Unknown Field를 자동 삭제하지 않는다.
2. Unknown Option을 자동 교정하지 않는다.
3. Property Soft Delete 시 Item 값을 유지한다.
4. Display Name 변경으로 Item Migration을 수행하지 않는다.
5. Schema Migration 전 Backup한다.
6. Parse 실패 시 원문을 유지한다.
7. 자동 저장 전에 외부 수정 여부를 검사한다.

---

# 32. 향후 확장 고려

아래 Type은 Post-MVP로 둔다.

```text
created_time
modified_time
url
relation
formula
rollup
files
```

현재 Data Model은 신규 Property Type을 추가할 수 있는 구조로 유지한다.