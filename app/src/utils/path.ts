import { WorkspaceError } from '@/domain/errors'

const protectedTopLevelNames = new Set(['.workspace'])

export function normalizeWorkspaceEntryName(name: string) {
  const normalizedName = name.trim().normalize('NFC')
  const windowsDeviceName = normalizedName.split('.')[0]?.toUpperCase()
  const hasControlCharacter = [...normalizedName].some(
    (character) => (character.codePointAt(0) ?? 0) <= 31,
  )

  if (
    !normalizedName ||
    normalizedName === '.' ||
    normalizedName === '..' ||
    normalizedName === '.workspace' ||
    hasControlCharacter ||
    /[<>:"/\\|?*]/.test(normalizedName) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsDeviceName ?? '') ||
    /[. ]$/.test(normalizedName)
  ) {
    throw new WorkspaceError(
      'invalid-path',
      '운영체제에서 사용할 수 없는 이름입니다. 특수문자와 예약된 장치 이름을 제외해주세요.',
    )
  }

  return normalizedName
}

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
