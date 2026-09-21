export type HealthIssueSeverity = 'error' | 'warning'

export type HealthIssueCode =
  | 'invalid-manifest'
  | 'unsupported-version'
  | 'missing-directory'
  | 'invalid-schema'
  | 'duplicate-id'
  | 'invalid-item'
  | 'missing-reference'
  | 'invalid-view'
  | 'broken-attachment'
  | 'invalid-trash'
  | 'unreadable-file'

export interface HealthIssue {
  code: HealthIssueCode
  message: string
  path: string
  severity: HealthIssueSeverity
}

export interface HealthCheckReport {
  checkedAt: string
  healthy: boolean
  issues: HealthIssue[]
}

export interface MigrationResult {
  changed: boolean
  fromVersion: number
  toVersion: number
}

export class MigrationError extends Error {
  constructor(
    public readonly code:
      | 'invalid-target-version'
      | 'unsupported-source-version'
      | 'migration-unavailable'
      | 'migration-validation-failed',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'MigrationError'
  }
}
