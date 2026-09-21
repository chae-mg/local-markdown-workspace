# Local Markdown Workspace 작업 규칙

## 구조

- `apps/`에는 독립적으로 실행·빌드·배포되는 애플리케이션을 둡니다.
- 현재 웹앱은 `apps/web/`에 둡니다.
- `packages/`는 실제로 두 앱 이상에서 공유할 코드가 생길 때만 추가합니다.
- `docs/`에는 제품, 아키텍처, 개발, 결정, 작업 상태 문서를 둡니다.
- 실제 사용자의 Markdown Workspace는 이 레포 밖의 로컬 폴더입니다.

## 작업 전 확인 순서

1. `docs/00_INDEX.md`
2. `docs/07_STATUS/CURRENT.md`
3. 요청한 기능 문서
4. 관련 아키텍처·데이터 모델 문서
5. 실제 코드

## 변경 규칙

- 사용자 Content의 Source of Truth는 로컬 Markdown 파일입니다.
- 앱 코드에서 File System Access API를 직접 호출하지 말고 서비스를 통해 접근합니다.
- `packages/`로 코드를 옮기기 전에 두 번째 사용처가 실제로 있는지 확인합니다.
- 구조를 변경할 때는 Vite, TypeScript, Playwright, GitHub Actions, Pages 경로를 함께 확인합니다.
- `docs/07_STATUS/INBOX.md`의 내용은 확정 요구사항으로 간주하지 않습니다.

## 문서화

- 실제 상태가 바뀌면 `docs/07_STATUS/CURRENT.md`를 갱신합니다.
- 완료한 작업과 검증 결과는 `docs/07_STATUS/WORKLOG.md`에 기록합니다.
- 중요한 기술·구조 결정은 `docs/06_DECISIONS/`에 ADR로 기록합니다.

## 검증

의미 있는 변경 뒤에는 다음을 실행합니다.

```text
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```
