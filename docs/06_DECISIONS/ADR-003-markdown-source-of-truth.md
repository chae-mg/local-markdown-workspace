# ADR-003 — Markdown을 사용자 Content의 Source of Truth로 사용한다

## Status

Accepted

## Context

제품은 Markdown을 AI와 업무 문서에 적합한 범용 포맷으로 활용하는 것이 핵심이다.

앱 전용 Database에 Content를 저장하면 VS Code, Obsidian 등 다른 Tool과의 호환성이 낮아진다.

## Decision

일반 Document와 Database Item의 실제 Content는 Markdown File로 저장한다.

Database Property 값은 YAML Frontmatter에 저장한다.

예:

```markdown
---
id: item_a83f21
prop_status: opt_progress
---

# Dashboard 개선
```

## Consequences

### 장점

- Vendor Lock-in 감소
- Git 사용 가능
- VS Code / Obsidian 호환
- AI에 직접 전달 가능
- 사람이 직접 File을 열어 확인 가능

### 단점

- 대규모 Query는 Server DB보다 느림
- File Parsing 필요
- 외부 수정 Conflict 처리 필요

## Guardrail

앱이 이해하지 못하는 Metadata를 발견하더라도 임의 삭제하지 않는다.