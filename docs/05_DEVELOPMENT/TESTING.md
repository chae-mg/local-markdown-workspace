# 테스트

## 자동 검증

저장소 루트에서 실행합니다.

```text
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

단위 테스트와 컴포넌트 테스트는 Vitest·Testing Library로 실행하고, 브라우저 흐름은 Playwright로 검증합니다.

## 범위 원칙

- File System Access API와 Workspace 서비스는 도메인·서비스 테스트로 검증합니다.
- 실제 Chrome 폴더 선택과 권한 흐름은 E2E 또는 수동 브라우저 확인으로 검증합니다.
- 구조 변경 뒤에는 `RELEASE_CHECKLIST.md`의 핵심 흐름을 다시 확인합니다.
