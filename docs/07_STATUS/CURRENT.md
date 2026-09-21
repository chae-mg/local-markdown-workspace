# 현재 상태

## 제품

Local Markdown Workspace는 브라우저에서 로컬 Markdown Workspace를 열고, 일반 문서와 Database View를 안전하게 편집하는 Local-first 웹앱입니다.

## 저장소 구조

- 실행 앱: `apps/web/`
- 제품·기획 문서: `docs/01_PRODUCT/`
- 아키텍처·데이터 모델: `docs/02_ARCHITECTURE/`
- 개발 점검 문서: `docs/05_DEVELOPMENT/`
- ADR: `docs/06_DECISIONS/`
- 작업 상태: `docs/07_STATUS/`
- 공유 패키지: 아직 없음. 두 번째 앱과 실제 공유 코드가 생길 때 추가합니다.

## 구현 상태

- React + TypeScript + Vite 기반 웹앱
- File System Access API 기반 Local-first Workspace
- Markdown WYSIWYG/Source 편집과 자동 저장
- Database Table/Kanban, Schema, View
- Search, Health Check, Undo, Backup, Trash
- PWA 설치 및 오프라인 앱 셸
- GitHub Actions CI와 GitHub Pages 배포

## 이번 구조 정리

현재 단일 앱을 `apps/web/`로 이동하고, 루트 workspace 명령과 문서 분류를 추가했습니다. 앱 내부의 `src/domain`, `src/services`, `src/stores`, `src/components`는 단일 앱 내부 책임이므로 그대로 유지합니다.
