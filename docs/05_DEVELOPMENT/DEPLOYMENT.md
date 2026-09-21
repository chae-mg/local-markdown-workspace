# 배포

## GitHub Pages

`main` 브랜치에 변경이 반영되면 GitHub Actions가 다음 순서로 실행됩니다.

1. `apps/web/` 의존성 설치
2. 포맷 검사, lint, 단위 테스트, production build, E2E 실행
3. `apps/web/dist/`를 Pages artifact로 업로드
4. GitHub Pages에 배포

앱은 Repository Project Site 하위 경로를 지원하도록 Vite base path와 Hash Routing을 사용합니다.

배포 후 최종 확인은 [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md)를 따릅니다.
