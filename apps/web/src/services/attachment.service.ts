import type { SavedAttachment } from '@/domain/attachment'
import { WorkspaceError } from '@/domain/errors'
import type { FileSystemService } from '@/services/file-system.service'
import {
  joinWorkspacePath,
  normalizeWorkspacePath,
  splitWorkspacePath,
} from '@/utils/path'

const attachmentDirectory = 'Attachments'
const imageExtensions = new Set([
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
])
const mimeTypeExtensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/plain': 'txt',
}

export interface AttachmentApplicationService {
  readAttachment(
    documentPath: string,
    relativePath: string,
  ): Promise<File | null>
  saveAttachment(documentPath: string, file: File): Promise<SavedAttachment>
}

function extensionForFile(file: File) {
  const match = file.name.toLocaleLowerCase().match(/\.([a-z0-9]{1,12})$/)
  return match?.[1] ?? mimeTypeExtensions[file.type] ?? 'bin'
}

function isImageFile(file: File, extension: string) {
  return file.type.startsWith('image/') || imageExtensions.has(extension)
}

function escapeMarkdownLabel(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
}

function labelForFile(file: File) {
  const extension = extensionForFile(file)
  const suffix = `.${extension}`
  const name = file.name.toLocaleLowerCase().endsWith(suffix)
    ? file.name.slice(0, -suffix.length)
    : file.name
  return escapeMarkdownLabel(
    name || (file.type.startsWith('image/') ? '이미지' : '첨부 파일'),
  )
}

export function relativePathFromDocument(
  documentPath: string,
  targetPath: string,
) {
  const fromSegments = splitWorkspacePath(documentPath)
  fromSegments.pop()
  const targetSegments = splitWorkspacePath(targetPath)
  let sharedSegments = 0

  while (
    sharedSegments < fromSegments.length &&
    sharedSegments < targetSegments.length &&
    fromSegments[sharedSegments] === targetSegments[sharedSegments]
  ) {
    sharedSegments += 1
  }

  return [
    ...Array.from({ length: fromSegments.length - sharedSegments }, () => '..'),
    ...targetSegments.slice(sharedSegments),
  ].join('/')
}

export function resolveAttachmentPath(
  documentPath: string,
  relativePath: string,
) {
  if (
    !relativePath ||
    relativePath.startsWith('/') ||
    relativePath.startsWith('#') ||
    /^[a-z][a-z\d+.-]*:/i.test(relativePath)
  ) {
    return null
  }

  const pathWithoutQuery = relativePath.split(/[?#]/, 1)[0] ?? ''
  const resolvedSegments = splitWorkspacePath(documentPath)
  resolvedSegments.pop()

  for (const encodedSegment of pathWithoutQuery
    .replaceAll('\\', '/')
    .split('/')) {
    if (!encodedSegment || encodedSegment === '.') {
      continue
    }

    if (encodedSegment === '..') {
      if (resolvedSegments.length === 0) {
        return null
      }
      resolvedSegments.pop()
      continue
    }

    let segment: string
    try {
      segment = decodeURIComponent(encodedSegment)
    } catch {
      return null
    }

    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      /[/\\]/.test(segment)
    ) {
      return null
    }
    resolvedSegments.push(segment)
  }

  const resolvedPath = normalizeWorkspacePath(resolvedSegments.join('/'))
  return resolvedPath.startsWith(`${attachmentDirectory}/`)
    ? resolvedPath
    : null
}

export class AttachmentService<
  DirectoryHandle,
> implements AttachmentApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly createId = () => crypto.randomUUID().replaceAll('-', ''),
  ) {}

  async saveAttachment(documentPath: string, file: File) {
    const normalizedDocumentPath = normalizeWorkspacePath(documentPath)
    const extension = extensionForFile(file)
    const isImage = isImageFile(file, extension)
    const prefix = isImage ? 'img' : 'file'
    const root = this.getRoot()
    const existingNames = new Set(
      (await this.fileSystem.listDirectory(root, attachmentDirectory)).map(
        (entry) => entry.name.toLocaleLowerCase(),
      ),
    )
    let fileName = ''

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${prefix}_${this.createId()}.${extension}`
      if (!existingNames.has(candidate.toLocaleLowerCase())) {
        fileName = candidate
        break
      }
    }

    if (!fileName) {
      throw new WorkspaceError(
        'entry-already-exists',
        '고유한 첨부 파일 이름을 만들지 못했습니다. 다시 시도해주세요.',
      )
    }

    const path = joinWorkspacePath(attachmentDirectory, fileName)
    await this.fileSystem.writeFile(root, path, file)
    const relativePath = relativePathFromDocument(normalizedDocumentPath, path)
    const label = labelForFile(file)

    return {
      isImage,
      markdown: isImage
        ? `![${label}](${relativePath})`
        : `[${escapeMarkdownLabel(file.name || '첨부 파일')}](${relativePath})`,
      mimeType: file.type,
      originalName: file.name,
      path,
      relativePath,
      size: file.size,
    } satisfies SavedAttachment
  }

  async readAttachment(documentPath: string, relativePath: string) {
    const path = resolveAttachmentPath(documentPath, relativePath)
    if (!path) {
      return null
    }

    return this.fileSystem.readFile(this.getRoot(), path)
  }
}
