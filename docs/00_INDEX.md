# 문서 인덱스

이 문서는 Local Markdown Workspace의 제품·구조·개발·상태 문서를 찾기 위한 시작점입니다.

## 어디서 무엇을 찾나요?

| 목적 | 문서 |
| --- | --- |
| 제품 목적·범위·로드맵 | [`01_PRODUCT/PRD.md`](./01_PRODUCT/PRD.md), [`01_PRODUCT/PLAN.md`](./01_PRODUCT/PLAN.md) |
| 전체 구조·데이터 흐름 | [`02_ARCHITECTURE/ARCHITECTURE.md`](./02_ARCHITECTURE/ARCHITECTURE.md) |
| 폴더·파일 책임 | [`02_ARCHITECTURE/REPOSITORY_STRUCTURE.md`](./02_ARCHITECTURE/REPOSITORY_STRUCTURE.md) |
| 데이터 모델 | [`02_ARCHITECTURE/DATA_MODEL.md`](./02_ARCHITECTURE/DATA_MODEL.md) |
| 개발 환경·테스트·배포 | [`05_DEVELOPMENT/`](./05_DEVELOPMENT/) |
| 기술·제품 결정 | [`06_DECISIONS/`](./06_DECISIONS/) |
| 현재 상태·다음 작업·작업 기록 | [`07_STATUS/`](./07_STATUS/) |

## 작업 전 읽는 순서

1. 루트 [`AGENTS.md`](../AGENTS.md)
2. 이 문서
3. [`07_STATUS/CURRENT.md`](./07_STATUS/CURRENT.md)
4. 요청한 기능과 관련된 문서
5. 관련 아키텍처·데이터 모델 문서

## 구조 원칙

- 실행 앱은 `apps/`에 둡니다.
- 여러 앱에서 실제로 공유하는 코드가 생길 때만 `packages/`를 추가합니다.
- 문서의 역할은 폴더 이름으로 구분하고, 기존 앱 코드는 안정성을 확인한 뒤 이동합니다.
