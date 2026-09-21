# Release Checklist

이 문서는 `main`에 반영하기 전과 GitHub Pages 배포 후 확인할 항목을 정리한다.

## 자동 검증

저장소 루트에서 다음 명령을 순서대로 실행한다.

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

## 핵심 브라우저 흐름

- 초기 화면에서 Workspace 폴더를 선택한다.
- Documents 문서를 생성하고 Markdown 원문·WYSIWYG 편집을 확인한다.
- 자동 저장을 끄고 수동 저장, Undo, 외부 변경 충돌을 확인한다.
- 자동 저장이 실행되는 동안에도 편집 입력이 잠기거나 커서가 끊기지 않는지 확인한다.
- 설정에서 테마·Accent·폰트·자동 저장을 변경하고 새로고침 후 유지되는지 확인한다.
- 검색에서 파일명·제목·본문·Property 결과를 열어본다.
- 설정의 Workspace 검사를 실행하고 결과를 확인한다.
- 파일을 휴지통으로 이동·복원하고, 휴지통 비우기를 명시적으로 실행한다.

## 배포 확인

- GitHub Actions의 `build`와 `deploy` Job이 모두 성공한다.
- `https://chae-mg.github.io/local-markdown-workspace/`가 HTTP 200을 반환한다.
- Hash URL로 새로고침해도 초기 Workspace 화면이 표시된다.
- Manifest와 Service Worker가 등록되고 설치 가능한 PWA로 표시되는지 확인한다.
- 최초 접속 후 네트워크를 끊고 앱 셸을 다시 열 수 있는지 확인한다.
- 사용자 Markdown 원본과 `.workspace/` Metadata가 배포 과정에서 변경되지 않는다.

## 수동 환경 확인

- 최신 Chrome의 HTTPS 환경에서 Folder Picker와 Read/Write 권한을 확인한다.
- Windows와 macOS에서 상대 경로 Attachment가 열리는지 확인한다.
- Google Drive·OneDrive 동기화 폴더에서 동시 편집 없이 PC를 바꿔 열 수 있는지 확인한다.

## 알려진 비차단 항목

- Production Build에서 Editor 의존성으로 500KB 초과 Chunk 경고가 발생한다. 기능과 배포를 차단하지 않으며, 별도 성능 최적화 작업으로 분리한다.
