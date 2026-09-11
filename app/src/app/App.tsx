import {
  BookOpenText,
  Database,
  FileText,
  FolderCheck,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  PanelLeft,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { DocumentEditor } from '@/components/editor/document-editor'
import { DatabaseWorkspace } from '@/components/database/database-workspace'
import { WorkspaceTrash } from '@/components/file-tree/workspace-trash'
import { WorkspaceTree } from '@/components/file-tree/workspace-tree'
import { Button } from '@/components/ui/button'
import { useDocumentStore } from '@/stores/document.store'
import { useWorkspaceStore } from '@/stores/workspace.store'

const navigationItems = [
  { id: 'documents', label: '문서', icon: FileText },
  { id: 'databases', label: '데이터베이스', icon: Database },
] as const

type NavigationSection = 'documents' | 'databases'

function WelcomePage() {
  const [activeSection, setActiveSection] =
    useState<NavigationSection>('documents')
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] =
    useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const {
    clearMutationError,
    createFolder,
    createMarkdownFile,
    emptyTrash,
    entries,
    errorMessage,
    initialize,
    initializeWorkspace,
    moveEntryToTrash,
    openWorkspace,
    refreshWorkspace,
    reconnectWorkspace,
    refreshTrash,
    mutationErrorMessage,
    mutationStatus,
    moveEntry,
    renameEntry,
    restoreTrashEntry,
    selectedDirectoryPath,
    selectedPath,
    selectDirectory,
    selectEntry,
    status,
    treeErrorMessage,
    treeStatus,
    trashEntries,
    trashErrorMessage,
    trashStatus,
    workspace,
  } = useWorkspaceStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (status === 'ready') {
      void refreshWorkspace()
      void refreshTrash()
    }
  }, [refreshTrash, refreshWorkspace, status, workspace?.manifest?.id])

  const isInitializing = status === 'initializing'
  const isOpening =
    status === 'checking' || status === 'opening' || isInitializing
  const isUnsupported = status === 'unsupported'
  const needsInitialization = status === 'initialization-required'
  const needsPermission = status === 'permission-required'
  const isReady = status === 'ready'

  const handleWorkspaceAction = needsInitialization
    ? initializeWorkspace
    : needsPermission
      ? reconnectWorkspace
      : openWorkspace

  const buttonLabel = isOpening
    ? isInitializing
      ? 'Workspace 준비 중'
      : 'Workspace 확인 중'
    : isUnsupported
      ? '지원되는 Chrome이 필요합니다'
      : needsInitialization
        ? 'Workspace로 초기화'
        : needsPermission
          ? '접근 권한 다시 허용'
          : isReady
            ? '다른 워크스페이스 열기'
            : '워크스페이스 열기'

  const saveBeforeNavigation = async () => {
    const documentState = useDocumentStore.getState()
    if (
      !documentState.document ||
      documentState.draftSource === documentState.document.source
    ) {
      return true
    }

    if (documentState.preservationWarning) {
      return false
    }

    return documentState.saveDocument()
  }

  const handleEntrySelect = async (path: string) => {
    if (path === selectedPath || (await saveBeforeNavigation())) {
      selectEntry(path)
      setActiveSection('documents')
      setIsMobileSidebarOpen(false)
    }
  }

  const handleDirectorySelect = async (path: string) => {
    if (await saveBeforeNavigation()) {
      selectDirectory(path)
      setActiveSection('documents')
      setIsMobileSidebarOpen(false)
    }
  }

  const handleNavigation = async (
    section: (typeof navigationItems)[number]['id'],
  ) => {
    if (section === activeSection) {
      setIsMobileSidebarOpen(false)
      return
    }

    if (await saveBeforeNavigation()) {
      setActiveSection(section)
      setIsMobileSidebarOpen(false)
    }
  }

  const handleOpenDatabaseItem = async (path: string) => {
    await refreshWorkspace()
    selectEntry(path)
    setActiveSection('documents')
    setIsMobileSidebarOpen(false)
  }

  const handleDatabaseWorkspaceChanged = async () => {
    await Promise.all([refreshWorkspace(), refreshTrash()])
  }

  const handleCreateFolder = async (parentPath: string, name: string) =>
    (await saveBeforeNavigation()) && createFolder(parentPath, name)

  const handleCreateMarkdownFile = async (parentPath: string, name: string) =>
    (await saveBeforeNavigation()) && createMarkdownFile(parentPath, name)

  const handleMoveEntry = async (
    path: string,
    destinationDirectoryPath: string,
  ) =>
    (await saveBeforeNavigation()) && moveEntry(path, destinationDirectoryPath)

  const handleMoveToTrash = async (path: string) =>
    (await saveBeforeNavigation()) && moveEntryToTrash(path)

  const handleRenameEntry = async (path: string, name: string) =>
    (await saveBeforeNavigation()) && renameEntry(path, name)

  const handleRestoreTrashEntry = async (id: string, name: string) =>
    (await saveBeforeNavigation()) && restoreTrashEntry(id, name)

  const handleSidebarToggle = () => {
    if (window.matchMedia?.('(min-width: 768px)').matches) {
      setIsDesktopSidebarCollapsed((current) => !current)
      return
    }

    setIsMobileSidebarOpen((current) => !current)
  }

  const currentPageLabel =
    activeSection === 'databases'
      ? '데이터베이스'
      : (selectedPath?.split('/').at(-1) ?? workspace?.name ?? '시작하기')

  const workspaceStatusLabel = workspace
    ? `${workspace.name} · ${
        isReady ? '연결됨' : needsInitialization ? '초기화 필요' : '권한 필요'
      }`
    : '연결된 워크스페이스 없음'

  return (
    <div className="app-shell flex h-dvh min-h-[36rem] overflow-hidden bg-[var(--ui-surface)] text-[var(--ui-text)]">
      {isMobileSidebarOpen ? (
        <button
          aria-label="사이드바 바깥 영역 닫기"
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label="워크스페이스 사이드바"
        className={`fixed inset-y-0 left-0 z-40 flex w-[252px] shrink-0 flex-col overflow-hidden border-r border-[var(--ui-border)] bg-[var(--ui-sidebar)] transition-[width,transform,border] duration-200 md:static md:z-auto md:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDesktopSidebarCollapsed ? 'md:w-0 md:border-r-0' : 'md:w-[252px]'
        }`}
      >
        <div className="flex h-[58px] w-[252px] shrink-0 items-center gap-2.5 px-2.5 pl-3">
          <div className="grid size-[30px] shrink-0 place-items-center rounded-[7px] bg-[var(--ui-text)] font-serif text-base font-bold text-[var(--ui-surface)]">
            L
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              {workspace?.name ?? 'Local Markdown'}
            </p>
            <p className="mt-px truncate text-[11px] text-[var(--ui-muted)]">
              {workspace ? '개인 워크스페이스' : '내 폴더가 원본입니다'}
            </p>
          </div>
          <button
            aria-label="사이드바 닫기"
            className="grid size-[30px] shrink-0 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <nav aria-label="주 탐색" className="w-[252px] px-2 pt-1 pb-2">
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={id === activeSection ? 'page' : undefined}
              className={`flex h-[31px] w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors ${
                id === activeSection
                  ? 'bg-[var(--ui-hover)] font-medium text-[var(--ui-text)]'
                  : 'text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              disabled={!isReady}
              key={label}
              onClick={() => void handleNavigation(id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex min-h-0 w-[252px] flex-1 flex-col overflow-y-auto px-3 pb-2">
          {isReady && workspace ? (
            <>
              <WorkspaceTree
                entries={entries}
                errorMessage={treeErrorMessage}
                isLoading={treeStatus === 'loading'}
                isMutating={mutationStatus !== 'idle'}
                key={workspace.manifest?.id ?? workspace.name}
                mutationErrorMessage={mutationErrorMessage}
                onClearMutationError={clearMutationError}
                onCreateFolder={handleCreateFolder}
                onCreateMarkdownFile={handleCreateMarkdownFile}
                onDirectorySelect={(path) => void handleDirectorySelect(path)}
                onMoveEntry={handleMoveEntry}
                onMoveToTrash={handleMoveToTrash}
                onRefresh={() => void refreshWorkspace()}
                onRenameEntry={handleRenameEntry}
                onSelect={(path) => void handleEntrySelect(path)}
                selectedDirectoryPath={selectedDirectoryPath}
                selectedPath={selectedPath}
                workspaceName={workspace.name}
              />
              <WorkspaceTrash
                entries={trashEntries}
                errorMessage={trashErrorMessage}
                isLoading={trashStatus === 'loading'}
                isMutating={mutationStatus !== 'idle'}
                mutationErrorMessage={mutationErrorMessage}
                onClearMutationError={clearMutationError}
                onEmpty={emptyTrash}
                onRefresh={() => void refreshTrash()}
                onRestore={handleRestoreTrashEntry}
              />
            </>
          ) : (
            <div className="mt-3 rounded-md px-2 py-3 text-xs leading-5 text-[var(--ui-muted)]">
              폴더를 연결하면 문서와 데이터베이스가 여기에 표시됩니다.
            </div>
          )}
        </div>

        <div className="w-[252px] shrink-0 border-t border-[var(--ui-border)] p-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-[var(--ui-muted)]">
            <ShieldCheck
              aria-hidden="true"
              className={`size-4 ${isReady ? 'text-emerald-600' : ''}`}
            />
            <span className="min-w-0 truncate">{workspaceStatusLabel}</span>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[var(--ui-surface)]">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-2 sm:px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              aria-label="사이드바 전환"
              className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
              onClick={handleSidebarToggle}
              type="button"
            >
              <PanelLeft aria-hidden="true" className="size-[18px]" />
            </button>
            <div className="flex min-w-0 items-center gap-1.5 px-1 text-[13px]">
              <span className="hidden truncate text-[var(--ui-muted)] sm:inline">
                {activeSection === 'databases' ? '데이터베이스' : '문서'}
              </span>
              <span
                aria-hidden="true"
                className="hidden text-[var(--ui-faint)] sm:inline"
              >
                /
              </span>
              <strong className="truncate font-medium">
                {currentPageLabel}
              </strong>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 px-1 text-xs text-[var(--ui-muted)]">
            {isReady ? (
              <FolderCheck
                aria-hidden="true"
                className="size-3.5 text-emerald-600"
              />
            ) : (
              <HardDrive aria-hidden="true" className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {isReady ? '내 폴더와 연결됨' : '로컬 폴더 연결 대기'}
            </span>
          </div>
        </header>

        {isReady && activeSection === 'databases' && workspace ? (
          <DatabaseWorkspace
            key={workspace.manifest?.id ?? workspace.name}
            onOpenItem={handleOpenDatabaseItem}
            onWorkspaceChanged={handleDatabaseWorkspaceChanged}
          />
        ) : isReady && selectedPath ? (
          <DocumentEditor
            key={selectedPath}
            onClose={() => void handleDirectorySelect(selectedDirectoryPath)}
            path={selectedPath}
          />
        ) : (
          <section className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-7 pt-16 pb-20 sm:px-12 sm:pt-24">
              <div className="mb-5 grid size-12 place-items-center rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
                <BookOpenText aria-hidden="true" className="size-6" />
              </div>
              <h1 className="max-w-2xl text-4xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                {needsInitialization ? (
                  <>
                    이 폴더를 Workspace로
                    <br />
                    준비할까요?
                  </>
                ) : isReady ? (
                  <>
                    {workspace?.name} Workspace가
                    <br />
                    준비되었습니다.
                  </>
                ) : (
                  <>
                    내 파일은 내 폴더에,
                    <br />
                    편집은 더 편안하게.
                  </>
                )}
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-[var(--ui-muted)] sm:text-base">
                {needsInitialization
                  ? '기존 파일은 그대로 두고 Documents, Databases, Attachments와 앱 Metadata 폴더만 추가합니다.'
                  : isReady
                    ? selectedPath
                      ? `${selectedPath} 문서를 선택했습니다. 다음 Editor 단계에서 이 파일을 열고 편집할 수 있게 됩니다.`
                      : '왼쪽 파일 트리에서 문서와 폴더를 만들고, 선택한 항목의 이름을 바꾸거나 휴지통으로 이동할 수 있습니다. 기존 항목은 덮어쓰지 않습니다.'
                    : 'Markdown을 원본 그대로 유지하면서 문서와 데이터베이스를 한곳에서 관리하세요. 앱이 없어져도 파일은 언제나 사용자의 것입니다.'}
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isOpening || isUnsupported}
                    onClick={() => void handleWorkspaceAction()}
                    size="lg"
                  >
                    {isOpening ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : needsPermission ? (
                      <RefreshCw aria-hidden="true" className="size-4" />
                    ) : (
                      <FolderOpen aria-hidden="true" className="size-4" />
                    )}
                    {buttonLabel}
                  </Button>
                  {needsPermission || needsInitialization ? (
                    <Button
                      onClick={() => void openWorkspace()}
                      size="lg"
                      variant="outline"
                    >
                      다른 폴더 선택
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-[var(--ui-muted)]">
                  {isUnsupported
                    ? 'HTTPS 또는 localhost의 최신 Chrome에서 열어주세요.'
                    : needsInitialization
                      ? '초기화 전에는 기존 파일을 수정하거나 이동하지 않습니다.'
                      : needsPermission
                        ? '최근 폴더를 기억하고 있지만 Chrome 권한이 필요합니다.'
                        : '선택한 폴더의 핸들은 이 브라우저에만 저장됩니다.'}
                </p>
              </div>

              {errorMessage ? (
                <div
                  className="mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                  role="alert"
                >
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <dl className="mt-14 grid gap-5 border-t border-[var(--ui-border)] pt-6 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">
                    저장 위치
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    Local File System
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">
                    원본 형식
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">표준 Markdown</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">
                    지원 환경
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    Chrome · Windows · macOS
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<WelcomePage />} path="/" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}
