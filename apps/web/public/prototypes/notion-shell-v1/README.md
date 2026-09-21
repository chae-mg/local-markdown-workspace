# Notion-style UI Shell V1

실제 앱에 디자인을 적용하기 전에 화면 구조와 사용 흐름을 검토하기 위한 독립 프로토타입이다.

## 확정 상태

**2026-09-11 UI Foundation V1 확정**

이 프로토타입을 실제 앱 UI의 기준으로 사용한다. 후속 기능은 아래의 확정된 큰 틀 안에 추가하고, 전체 화면 골격을 바꿔야 할 때만 새 Prototype을 만든다.

확정된 기준:

- 252px Desktop Sidebar와 Mobile Drawer
- 간결한 Top Bar와 문서 중심 Content Canvas
- 문서와 Database를 Sidebar에서 전환하는 Navigation
- Sidebar 하단의 Settings 진입점
- Light / Dark / System Theme
- Preset 및 Custom Key Color
- Notion Default / Pretendard / Serif / Mono 문서 글꼴
- Server 기능으로 오해할 수 있는 공유 및 공동 편집 Action 제외

## 확인할 내용

- 252px Sidebar의 정보 밀도와 문서 트리 구조
- 문서 중심의 넓은 편집 영역과 간결한 Top Bar
- 문서와 Database 사이의 이동 방식
- 설정 진입 위치와 Dialog 구성
- Light / Dark Theme의 기본 방향
- 좁은 화면에서 Sidebar가 Drawer로 동작하는 방식

## 포함된 상호작용

- Sidebar 열기와 닫기
- `제품 로드맵`과 `프로젝트` 화면 전환
- 설정 Dialog 열기와 닫기
- 자동 저장 Toggle
- Light / Dark / System Theme 전환
- Blue / Orange / Purple / Monochrome Key Color 전환
- Color Picker 또는 HEX 입력으로 Custom Key Color 저장 및 복원
- Notion Default / Pretendard / Serif / Mono 문서 글꼴 전환 및 복원

Notion처럼 Server와 Account가 필요한 공유 및 공동 편집 Action은 표시하지 않는다. 즐겨찾기는 향후 Local Metadata 저장 정책을 정한 뒤 별도 범위로 검토한다.

## 주의

이 파일은 UI 구조 검토용이며 실제 Workspace 파일을 읽거나 수정하지 않는다. 시안이 확정된 뒤 공통 Design Token과 Component를 실제 React 앱에 단계적으로 반영한다.
