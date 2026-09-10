import {
  DocumentConflictError,
  type DocumentSnapshot,
  type SaveDocumentRequest,
} from '@/domain/document'
import { WorkspaceError } from '@/domain/errors'
import type { FileSystemService } from '@/services/file-system.service'
import { assertMutableWorkspacePath } from '@/utils/path'

export interface DocumentApplicationService {
  openDocument(path: string): Promise<DocumentSnapshot>
  saveDocument(request: SaveDocumentRequest): Promise<DocumentSnapshot>
}

export class DocumentService<
  DirectoryHandle,
> implements DocumentApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
  ) {}

  async openDocument(path: string) {
    const normalizedPath = this.assertMarkdownPath(path)
    const root = this.getRoot()
    const metadataBeforeRead = await this.fileSystem.getFileMetadata(
      root,
      normalizedPath,
    )
    const source = await this.fileSystem.readTextFile(root, normalizedPath)
    const metadataAfterRead = await this.fileSystem.getFileMetadata(
      root,
      normalizedPath,
    )

    if (
      metadataBeforeRead.lastModified !== metadataAfterRead.lastModified ||
      metadataBeforeRead.size !== metadataAfterRead.size
    ) {
      throw new DocumentConflictError(
        normalizedPath,
        this.requireLastModified(metadataAfterRead.lastModified),
      )
    }

    return this.toSnapshot(normalizedPath, source, metadataAfterRead)
  }

  async saveDocument(request: SaveDocumentRequest) {
    const normalizedPath = this.assertMarkdownPath(request.path)
    const root = this.getRoot()

    if (!request.force) {
      const [metadata, source] = await Promise.all([
        this.fileSystem.getFileMetadata(root, normalizedPath),
        this.fileSystem.readTextFile(root, normalizedPath),
      ])

      if (
        this.requireLastModified(metadata.lastModified) !==
          request.expectedLastModified ||
        source !== request.expectedSource
      ) {
        throw new DocumentConflictError(
          normalizedPath,
          this.requireLastModified(metadata.lastModified),
        )
      }
    }

    await this.fileSystem.writeTextFile(root, normalizedPath, request.source)
    const metadata = await this.fileSystem.getFileMetadata(root, normalizedPath)
    return this.toSnapshot(normalizedPath, request.source, metadata)
  }

  private assertMarkdownPath(path: string) {
    const normalizedPath = assertMutableWorkspacePath(path)

    if (!normalizedPath.toLocaleLowerCase().endsWith('.md')) {
      throw new WorkspaceError(
        'invalid-path',
        'Markdown(.md) 문서만 편집할 수 있습니다.',
      )
    }

    return normalizedPath
  }

  private requireLastModified(value: number | null) {
    if (value === null) {
      throw new WorkspaceError(
        'file-system-error',
        '문서의 마지막 수정 시간을 확인할 수 없습니다.',
      )
    }

    return value
  }

  private toSnapshot(
    path: string,
    source: string,
    metadata: Awaited<
      ReturnType<FileSystemService<DirectoryHandle>['getFileMetadata']>
    >,
  ): DocumentSnapshot {
    if (metadata.kind !== 'file') {
      throw new WorkspaceError('invalid-path', '선택한 항목은 파일이 아닙니다.')
    }

    return {
      lastModified: this.requireLastModified(metadata.lastModified),
      path,
      size: metadata.size ?? new TextEncoder().encode(source).byteLength,
      source,
    }
  }
}
