export interface DocumentSnapshot {
  lastModified: number
  path: string
  size: number
  source: string
}

export interface SaveDocumentRequest {
  expectedLastModified: number
  expectedSource: string
  force?: boolean
  path: string
  source: string
}

export class DocumentConflictError extends Error {
  constructor(
    public readonly path: string,
    public readonly actualLastModified: number,
  ) {
    super(
      '이 문서가 다른 프로그램에서 변경되었습니다. 디스크 버전을 다시 불러오거나 현재 편집본으로 덮어쓸 수 있습니다.',
    )
    this.name = 'DocumentConflictError'
  }
}
