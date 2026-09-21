# ADR-001 — Chrome Only로 시작한다

## Status

Accepted

## Context

이 제품은 프로그램 설치 없이 로컬 Markdown 파일에 접근해야 한다.

브라우저마다 Local File System 접근 기능과 권한 처리 방식이 다르다.

초기부터 Chrome, Edge, Safari, Firefox를 모두 지원하면 구현과 QA 범위가 크게 증가한다.

## Decision

초기 공식 지원 Browser는 **Google Chrome 최신 버전**으로 제한한다.

운영체제는:

- Windows
- macOS

를 지원한다.

## Consequences

### 장점

- File System Access API 기준으로 단순화 가능
- Browser별 예외 처리 감소
- QA 범위 감소
- Windows/macOS를 하나의 Web Codebase로 지원

### 단점

- Safari/Firefox 사용자 제외
- Chrome 정책 변경 영향 존재

## Future

MVP 안정화 이후 다른 Chromium Browser 및 Safari 지원 여부를 별도 검토한다.