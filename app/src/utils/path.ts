import { WorkspaceError } from '@/domain/errors'

const protectedTopLevelNames = new Set(['.workspace'])

export function splitWorkspacePath(path: string) {
  const normalizedPath = path.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')

  if (!normalizedPath) {
    return []
  }

  const segments = normalizedPath.split('/')

  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new WorkspaceError(
      'invalid-path',
      `유효하지 않은 Workspace 상대 경로입니다: ${path}`,
    )
  }

  return segments
}

export function normalizeWorkspacePath(path: string) {
  return splitWorkspacePath(path).join('/')
}

export function joinWorkspacePath(parentPath: string, name: string) {
  return normalizeWorkspacePath([parentPath, name].filter(Boolean).join('/'))
}

export function isProtectedWorkspacePath(path: string) {
  const [topLevelName] = splitWorkspacePath(path)
  return topLevelName ? protectedTopLevelNames.has(topLevelName) : true
}

export function assertMutableWorkspacePath(
  path: string,
  allowProtected = false,
) {
  const normalizedPath = normalizeWorkspacePath(path)

  if (!normalizedPath) {
    throw new WorkspaceError(
      'protected-path',
      'Workspace Root는 변경할 수 없습니다.',
    )
  }

  if (!allowProtected && isProtectedWorkspacePath(normalizedPath)) {
    throw new WorkspaceError(
      'protected-path',
      '.workspace 내부는 일반 파일 작업으로 변경할 수 없습니다.',
    )
  }

  return normalizedPath
}
