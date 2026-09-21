# ADR-004 — Data, Schema, View를 분리한다

## Status

Accepted

## Context

Markdown File을 Database Row로 사용할 경우 Property 정의와 Table/Kanban 표시 설정이 필요하다.

이 모든 정보를 Item Markdown 안에 넣으면 중복이 커지고 View 변경이 Content 변경으로 이어진다.

## Decision

세 영역을 분리한다.

```text
Markdown
= Data

Schema
= Structure

View
= Presentation
```

Schema:

```text
.workspace/schemas/
```

View:

```text
.workspace/views/
```

Item:

```text
Databases/<db>/items/*.md
```

## Consequences

### 장점

- Property Rename이 Item Migration을 요구하지 않음
- 같은 Database에 여러 View 생성 가능
- Table/Kanban이 동일 Data 공유
- View 변경이 Markdown Content를 오염시키지 않음

### 단점

- 앱 Metadata 파일 관리 필요
- Schema 파일 유실 시 일부 의미 정보가 사라질 수 있음

## Mitigation

Workspace Health Check와 Backup을 통해 Schema/View 손상을 탐지하고 복구 가능성을 확보한다.