import type {
  DeleteEntryOptions,
  FileMetadata,
  FileMutationOptions,
  FileSystemAccessMode,
  WorkspaceEntry,
} from '@/domain/file-system'
import { WorkspaceError } from '@/domain/errors'
import type { FileSystemService } from '@/services/file-system.service'
import {
  assertMutableWorkspacePath,
  joinWorkspacePath,
  normalizeWorkspacePath,
  splitWorkspacePath,
} from '@/utils/path'

function isDomException(error: unknown, name: string) {
  return error instanceof DOMException && error.name === name
}

function toWorkspaceError(error: unknown, fallbackMessage: string) {
  if (error instanceof WorkspaceError) {
    return error
  }

  if (isDomException(error, 'AbortError')) {
    return new WorkspaceError('picker-cancelled', '폴더 선택을 취소했습니다.', {
      cause: error,
    })
  }

  if (isDomException(error, 'NotAllowedError')) {
    return new WorkspaceError(
      'permission-denied',
      'Workspace 접근 권한이 없습니다.',
      { cause: error },
    )
  }

  if (isDomException(error, 'NotFoundError')) {
    return new WorkspaceError('entry-not-found', '파일을 찾을 수 없습니다.', {
      cause: error,
    })
  }

  return new WorkspaceError('file-system-error', fallbackMessage, {
    cause: error,
  })
}

export class BrowserFileSystemService implements FileSystemService<FileSystemDirectoryHandle> {
  isSupported() {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext !== false &&
      'showDirectoryPicker' in window
    )
  }

  async selectDirectory() {
    if (!this.isSupported()) {
      throw new WorkspaceError(
        'unsupported-browser',
        'Chrome의 안전한 연결(HTTPS 또는 localhost)에서 사용할 수 있습니다.',
      )
    }

    try {
      return await window.showDirectoryPicker({
        id: 'local-markdown-workspace',
        mode: 'readwrite',
      })
    } catch (error) {
      throw toWorkspaceError(error, 'Workspace 폴더를 선택하지 못했습니다.')
    }
  }

  getDirectoryName(handle: FileSystemDirectoryHandle) {
    return handle.name
  }

  async queryPermission(
    handle: FileSystemDirectoryHandle,
    mode: FileSystemAccessMode = 'readwrite',
  ) {
    try {
      return await handle.queryPermission({ mode })
    } catch (error) {
      throw toWorkspaceError(error, 'Workspace 권한을 확인하지 못했습니다.')
    }
  }

  async requestPermission(
    handle: FileSystemDirectoryHandle,
    mode: FileSystemAccessMode = 'readwrite',
  ) {
    try {
      return await handle.requestPermission({ mode })
    } catch (error) {
      throw toWorkspaceError(error, 'Workspace 권한을 요청하지 못했습니다.')
    }
  }

  async listDirectory(root: FileSystemDirectoryHandle, path = '') {
    try {
      const normalizedPath = normalizeWorkspacePath(path)
      const directory = await this.resolveDirectory(
        root,
        splitWorkspacePath(normalizedPath),
      )
      const entries: WorkspaceEntry[] = []

      for await (const handle of directory.values()) {
        entries.push({
          kind: handle.kind,
          name: handle.name,
          path: joinWorkspacePath(normalizedPath, handle.name),
        })
      }

      return entries.sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'directory' ? -1 : 1
        }

        return left.name.localeCompare(right.name, 'ko')
      })
    } catch (error) {
      throw toWorkspaceError(error, '폴더 내용을 불러오지 못했습니다.')
    }
  }

  async readTextFile(root: FileSystemDirectoryHandle, path: string) {
    try {
      const fileHandle = await this.resolveFile(root, path)
      return await (await fileHandle.getFile()).text()
    } catch (error) {
      throw toWorkspaceError(error, '파일을 읽지 못했습니다.')
    }
  }

  async writeTextFile(
    root: FileSystemDirectoryHandle,
    path: string,
    content: string,
    options: FileMutationOptions = {},
  ) {
    const normalizedPath = assertMutableWorkspacePath(
      path,
      options.allowProtected,
    )

    try {
      const { name, parent } = await this.resolveParent(root, normalizedPath)
      const fileHandle = await parent.getFileHandle(name, { create: true })
      const writable = await fileHandle.createWritable()

      try {
        await writable.write(content)
        await writable.close()
      } catch (error) {
        await writable.abort(error).catch(() => undefined)
        throw error
      }
    } catch (error) {
      throw toWorkspaceError(error, '파일을 저장하지 못했습니다.')
    }
  }

  async createDirectory(
    root: FileSystemDirectoryHandle,
    path: string,
    options: FileMutationOptions = {},
  ) {
    const normalizedPath = assertMutableWorkspacePath(
      path,
      options.allowProtected,
    )

    try {
      await this.resolveDirectory(
        root,
        splitWorkspacePath(normalizedPath),
        true,
      )
    } catch (error) {
      throw toWorkspaceError(error, '폴더를 만들지 못했습니다.')
    }
  }

  async moveEntry(
    root: FileSystemDirectoryHandle,
    sourcePath: string,
    destinationPath: string,
    options: FileMutationOptions = {},
  ) {
    const normalizedSource = assertMutableWorkspacePath(
      sourcePath,
      options.allowProtected,
    )
    const normalizedDestination = assertMutableWorkspacePath(
      destinationPath,
      options.allowProtected,
    )

    if (
      normalizedSource === normalizedDestination ||
      normalizedDestination.startsWith(`${normalizedSource}/`)
    ) {
      throw new WorkspaceError(
        'invalid-path',
        '항목을 자기 자신 또는 하위 경로로 이동할 수 없습니다.',
      )
    }

    try {
      if (await this.entryExists(root, normalizedDestination)) {
        throw new WorkspaceError(
          'entry-already-exists',
          '이동할 위치에 같은 이름의 항목이 있습니다.',
        )
      }

      const source = await this.resolveEntry(root, normalizedSource)
      await this.copyEntry(root, source, normalizedDestination)
      await this.deleteEntry(root, normalizedSource, {
        allowProtected: options.allowProtected,
        recursive: source.kind === 'directory',
      })
    } catch (error) {
      throw toWorkspaceError(error, '파일 또는 폴더를 이동하지 못했습니다.')
    }
  }

  async deleteEntry(
    root: FileSystemDirectoryHandle,
    path: string,
    options: DeleteEntryOptions = {},
  ) {
    const normalizedPath = assertMutableWorkspacePath(
      path,
      options.allowProtected,
    )

    try {
      const { name, parent } = await this.resolveParent(root, normalizedPath)
      await parent.removeEntry(name, { recursive: options.recursive })
    } catch (error) {
      throw toWorkspaceError(error, '파일 또는 폴더를 삭제하지 못했습니다.')
    }
  }

  async getFileMetadata(root: FileSystemDirectoryHandle, path: string) {
    const normalizedPath = normalizeWorkspacePath(path)

    try {
      const entry = await this.resolveEntry(root, normalizedPath)

      if (entry.kind === 'directory') {
        return {
          kind: 'directory',
          name: entry.name,
          path: normalizedPath,
          lastModified: null,
          mimeType: null,
          size: null,
        } satisfies FileMetadata
      }

      const file = await entry.getFile()
      return {
        kind: 'file',
        name: entry.name,
        path: normalizedPath,
        lastModified: file.lastModified,
        mimeType: file.type || null,
        size: file.size,
      } satisfies FileMetadata
    } catch (error) {
      throw toWorkspaceError(error, '파일 Metadata를 읽지 못했습니다.')
    }
  }

  private async resolveDirectory(
    root: FileSystemDirectoryHandle,
    segments: string[],
    create = false,
  ) {
    let directory = root

    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment, { create })
    }

    return directory
  }

  private async resolveParent(root: FileSystemDirectoryHandle, path: string) {
    const segments = splitWorkspacePath(path)
    const name = segments.pop()

    if (!name) {
      throw new WorkspaceError('invalid-path', '파일 이름이 필요합니다.')
    }

    return {
      name,
      parent: await this.resolveDirectory(root, segments),
    }
  }

  private async resolveFile(root: FileSystemDirectoryHandle, path: string) {
    const normalizedPath = normalizeWorkspacePath(path)
    const { name, parent } = await this.resolveParent(root, normalizedPath)
    return parent.getFileHandle(name)
  }

  private async resolveEntry(
    root: FileSystemDirectoryHandle,
    path: string,
  ): Promise<FileSystemFileHandle | FileSystemDirectoryHandle> {
    const { name, parent } = await this.resolveParent(root, path)

    try {
      return await parent.getFileHandle(name)
    } catch (error) {
      if (
        !isDomException(error, 'NotFoundError') &&
        !isDomException(error, 'TypeMismatchError')
      ) {
        throw error
      }
    }

    return parent.getDirectoryHandle(name)
  }

  private async entryExists(root: FileSystemDirectoryHandle, path: string) {
    try {
      await this.resolveEntry(root, path)
      return true
    } catch (error) {
      if (isDomException(error, 'NotFoundError')) {
        return false
      }

      if (error instanceof WorkspaceError && error.code === 'entry-not-found') {
        return false
      }

      throw error
    }
  }

  private async copyEntry(
    root: FileSystemDirectoryHandle,
    source: FileSystemFileHandle | FileSystemDirectoryHandle,
    destinationPath: string,
  ) {
    if (source.kind === 'file') {
      const sourceFile = await source.getFile()
      const { name, parent } = await this.resolveParent(root, destinationPath)
      const destination = await parent.getFileHandle(name, { create: true })
      const writable = await destination.createWritable()

      try {
        await writable.write(await sourceFile.arrayBuffer())
        await writable.close()
      } catch (error) {
        await writable.abort(error).catch(() => undefined)
        throw error
      }

      const destinationFile = await destination.getFile()
      if (destinationFile.size !== sourceFile.size) {
        throw new WorkspaceError(
          'file-system-error',
          '복사한 파일의 크기가 원본과 일치하지 않습니다.',
        )
      }
      return
    }

    await this.createDirectory(root, destinationPath, { allowProtected: true })
    for await (const child of source.values()) {
      await this.copyEntry(
        root,
        child,
        joinWorkspacePath(destinationPath, child.name),
      )
    }
  }
}
