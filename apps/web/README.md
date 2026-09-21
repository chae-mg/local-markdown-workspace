# Local Markdown Workspace Web App

이 디렉터리는 사용자가 브라우저에서 실행하는 Local Markdown Workspace 앱입니다.

## 책임

- `src/`: 화면, 도메인, 서비스, 상태 관리
- `public/`: PWA 아이콘과 독립 UI Prototype
- `e2e/`: 실제 브라우저 흐름 테스트
- `vite.config.ts`: Vite, Vitest, PWA 설정
- `playwright.config.ts`: E2E 실행 설정

## 실행

저장소 루트에서 실행합니다.

```text
pnpm dev
pnpm test
pnpm test:e2e
```

앱 전용 명령이 필요하면 이 디렉터리에서 동일한 스크립트를 직접 실행할 수 있습니다.
