import type { RecentWorkspace } from '@/domain/file-system'
import { WorkspaceError } from '@/domain/errors'
import type { RecentWorkspaceStore } from '@/services/recent-workspace.store'

const databaseName = 'local-markdown-workspace'
const databaseVersion = 1
const objectStoreName = 'workspace-handles'
const recentWorkspaceKey = 'recent-workspace'

interface StoredWorkspace<
  DirectoryHandle,
> extends RecentWorkspace<DirectoryHandle> {
  id: typeof recentWorkspaceKey
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    })
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed')),
      { once: true },
    )
  })
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener(
      'abort',
      () =>
        reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
      { once: true },
    )
    transaction.addEventListener(
      'error',
      () =>
        reject(transaction.error ?? new Error('IndexedDB transaction failed')),
      { once: true },
    )
  })
}

export class IndexedDbRecentWorkspaceStore<
  DirectoryHandle,
> implements RecentWorkspaceStore<DirectoryHandle> {
  private databasePromise?: Promise<IDBDatabase>

  async load() {
    try {
      const database = await this.openDatabase()
      const transaction = database.transaction(objectStoreName, 'readonly')
      const storedWorkspace = await requestResult(
        transaction
          .objectStore(objectStoreName)
          .get(recentWorkspaceKey) as IDBRequest<
          StoredWorkspace<DirectoryHandle> | undefined
        >,
      )

      if (!storedWorkspace) {
        return null
      }

      const { handle, lastOpened, name } = storedWorkspace
      return { handle, lastOpened, name }
    } catch (error) {
      throw new WorkspaceError(
        'storage-error',
        '최근 Workspace 정보를 불러오지 못했습니다.',
        { cause: error },
      )
    }
  }

  async save(workspace: RecentWorkspace<DirectoryHandle>) {
    try {
      const database = await this.openDatabase()
      const transaction = database.transaction(objectStoreName, 'readwrite')
      transaction.objectStore(objectStoreName).put({
        id: recentWorkspaceKey,
        ...workspace,
      } satisfies StoredWorkspace<DirectoryHandle>)
      await transactionComplete(transaction)
    } catch (error) {
      throw new WorkspaceError(
        'storage-error',
        '최근 Workspace 정보를 저장하지 못했습니다.',
        { cause: error },
      )
    }
  }

  async clear() {
    try {
      const database = await this.openDatabase()
      const transaction = database.transaction(objectStoreName, 'readwrite')
      transaction.objectStore(objectStoreName).delete(recentWorkspaceKey)
      await transactionComplete(transaction)
    } catch (error) {
      throw new WorkspaceError(
        'storage-error',
        '최근 Workspace 정보를 삭제하지 못했습니다.',
        { cause: error },
      )
    }
  }

  private openDatabase() {
    this.databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion)

      request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains(objectStoreName)) {
          request.result.createObjectStore(objectStoreName, { keyPath: 'id' })
        }
      })
      request.addEventListener('success', () => resolve(request.result), {
        once: true,
      })
      request.addEventListener(
        'error',
        () => reject(request.error ?? new Error('IndexedDB open failed')),
        { once: true },
      )
    })

    return this.databasePromise
  }
}
