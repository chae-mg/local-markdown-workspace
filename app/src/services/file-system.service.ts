import type {
  DeleteEntryOptions,
  FileMetadata,
  FileMutationOptions,
  FileSystemAccessMode,
  WorkspaceEntry,
} from '@/domain/file-system'

export interface FileSystemService<DirectoryHandle> {
  isSupported(): boolean
  selectDirectory(): Promise<DirectoryHandle>
  getDirectoryName(handle: DirectoryHandle): string
  queryPermission(
    handle: DirectoryHandle,
    mode?: FileSystemAccessMode,
  ): Promise<PermissionState>
  requestPermission(
    handle: DirectoryHandle,
    mode?: FileSystemAccessMode,
  ): Promise<PermissionState>
  listDirectory(root: DirectoryHandle, path?: string): Promise<WorkspaceEntry[]>
  readTextFile(root: DirectoryHandle, path: string): Promise<string>
  writeTextFile(
    root: DirectoryHandle,
    path: string,
    content: string,
    options?: FileMutationOptions,
  ): Promise<void>
  createDirectory(
    root: DirectoryHandle,
    path: string,
    options?: FileMutationOptions,
  ): Promise<void>
  moveEntry(
    root: DirectoryHandle,
    sourcePath: string,
    destinationPath: string,
    options?: FileMutationOptions,
  ): Promise<void>
  deleteEntry(
    root: DirectoryHandle,
    path: string,
    options?: DeleteEntryOptions,
  ): Promise<void>
  getFileMetadata(root: DirectoryHandle, path: string): Promise<FileMetadata>
}
