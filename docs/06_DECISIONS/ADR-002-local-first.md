# ADR-002 — Local-first Architecture를 사용한다

## Status

Accepted

## Context

제품의 주요 목적은 업무용 Markdown을 설치 없이 쉽게 작성하고 관리하는 것이다.

회사 문서나 개인 업무 자료를 외부 Server에 저장하는 구조는 Privacy 및 도입 제약을 증가시킬 수 있다.

## Decision

사용자 Content는 기본적으로 **Local File System**에 저장한다.

Server Database, 사용자 계정, Cloud Sync는 MVP에 포함하지 않는다.

## Source of Truth

```text
Markdown Files
Attachments
.workspace Metadata
```

IndexedDB는 Cache와 Browser Handle 저장에만 사용한다.

## Consequences

### 장점

- 사용자 데이터 소유권 명확
- Cloud Vendor Lock-in 감소
- Server 비용 감소
- 회사 문서 사용 시 부담 감소
- 앱이 없어져도 Markdown 유지

### 단점

- Multi-device Sync 자동 제공 불가
- Collaboration 어려움
- Browser Permission 관리 필요

## Future

Cloud Sync가 필요해질 경우 Local-first 원칙을 유지한 Optional Sync Layer로 설계한다.