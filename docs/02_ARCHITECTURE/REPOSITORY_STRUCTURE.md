# 레포 구조

## 현재 구조

```text
local-markdown-workspace/
├─ apps/
│  └─ web/
│     ├─ src/
│     │  ├─ app/
│     │  ├─ components/
│     │  ├─ domain/
│     │  ├─ services/
│     │  ├─ stores/
│     │  ├─ utils/
│     │  └─ test/
│     ├─ e2e/
│     ├─ public/
│     ├─ package.json
│     └─ vite.config.ts
├─ docs/
│  ├─ 00_INDEX.md
│  ├─ 01_PRODUCT/
│  ├─ 02_ARCHITECTURE/
│  ├─ 05_DEVELOPMENT/
│  ├─ 06_DECISIONS/
│  ├─ 07_STATUS/
│  └─ _templates/
├─ .github/workflows/
├─ AGENTS.md
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
└─ README.md
```

## 책임

| 경로 | 책임 |
| --- | --- |
| `apps/web/src/app` | 앱 조립, 전역 설정, 진입점 |
| `apps/web/src/components` | 화면과 UI 컴포넌트 |
| `apps/web/src/domain` | 데이터 모델과 도메인 규칙 |
| `apps/web/src/services` | 파일 시스템·Markdown·Database·검색 등의 유스케이스 |
| `apps/web/src/stores` | Zustand 기반 세션·환경설정 상태 |
| `apps/web/src/utils` | 앱 내부 공용 유틸리티 |
| `apps/web/e2e` | Playwright 브라우저 시나리오 |
| `docs` | 제품·구조·개발·결정·상태 문서 |
| `packages` | 두 번째 앱에서 실제로 공유할 코드가 생긴 경우에만 사용 |

## 이동 원칙

현재는 실행 앱이 하나이므로 도메인·서비스 코드를 `packages/`로 분리하지 않습니다. 두 번째 실행 앱이나 CLI가 같은 코드를 실제로 사용할 때 별도 마이그레이션으로 분리합니다.
