export type WorkspaceErrorCode =
  | 'unsupported-browser'
  | 'permission-denied'
  | 'picker-cancelled'
  | 'workspace-not-open'
  | 'invalid-path'
  | 'protected-path'
  | 'entry-not-found'
  | 'entry-already-exists'
  | 'file-system-error'
  | 'storage-error'

export class WorkspaceError extends Error {
  constructor(
    public readonly code: WorkspaceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'WorkspaceError'
  }
}

export function isPickerCancellation(error: unknown) {
  return error instanceof WorkspaceError && error.code === 'picker-cancelled'
}
