import {
  Database,
  FileText,
  FolderCheck,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { WorkspaceTree } from '@/components/file-tree/workspace-tree'
import { Button } from '@/components/ui/button'
import { useWorkspaceStore } from '@/stores/workspace.store'

const navigationItems = [
  { label: '문서', icon: FileText },
  { label: '데이터베이스', icon: Database },
  { label: '검색', icon: Search },
]

function WelcomePage() {
  const {
    clearMutationError,
    createFolder,
    createMarkdownFile,
    entries,
    errorMessage,
    initialize,
    initializeWorkspace,
    openWorkspace,
    refreshWorkspace,
    reconnectWorkspace,
    mutationErrorMessage,
    mutationStatus,
    selectedDirectoryPath,
    selectedPath,
    selectDirectory,
    selectEntry,
    status,
    treeErrorMessage,
    treeStatus,
    workspace,
  } = useWorkspaceStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (status === 'ready') {
      void refreshWorkspace()
    }
  }, [refreshWorkspace, status, workspace?.manifest?.id])

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

  return (
    <div className="min-h-screen bg-stone-100 p-3 text-stone-950 sm:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1480px] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:min-h-[calc(100vh-2.5rem)]">
        <aside className="hidden min-h-0 w-64 shrink-0 border-r border-stone-200 bg-stone-50/80 p-5 md:flex md:flex-col">
          <div className="flex items-center gap-3 px-1">
            <div className="grid size-9 place-items-center rounded-xl bg-stone-950 text-sm font-semibold tracking-tight text-white">
              LM
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Local Markdown
              </p>
              <p className="text-xs text-stone-500">내 폴더가 원본입니다</p>
            </div>
          </div>

          <nav aria-label="주 탐색" className="mt-9 space-y-1">
            {navigationItems.map(({ label, icon: Icon }, index) => (
              <button
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  index === 0
                    ? 'bg-white font-medium text-stone-950 shadow-sm ring-1 ring-stone-200'
                    : 'text-stone-500 hover:bg-white hover:text-stone-800'
                }`}
                key={label}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </nav>

          {isReady && workspace ? (
            <WorkspaceTree
              entries={entries}
              errorMessage={treeErrorMessage}
              isLoading={treeStatus === 'loading'}
              isMutating={mutationStatus === 'creating'}
              key={workspace.manifest?.id ?? workspace.name}
              mutationErrorMessage={mutationErrorMessage}
              onClearMutationError={clearMutationError}
              onCreateFolder={createFolder}
              onCreateMarkdownFile={createMarkdownFile}
              onDirectorySelect={selectDirectory}
              onRefresh={() => void refreshWorkspace()}
              onSelect={selectEntry}
              selectedDirectoryPath={selectedDirectoryPath}
              selectedPath={selectedPath}
              workspaceName={workspace.name}
            />
          ) : null}

          <div className="mt-auto rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck
                aria-hidden="true"
                className="size-4 text-emerald-700"
              />
              Local-first
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              문서는 서버가 아닌 사용자가 선택한 로컬 폴더에 저장됩니다.
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-stone-200 px-5 sm:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <div className="grid size-8 place-items-center rounded-lg bg-stone-950 text-xs font-semibold text-white">
                LM
              </div>
              <span className="text-sm font-semibold">Local Markdown</span>
            </div>
            <div className="hidden items-center gap-2 text-sm text-stone-500 md:flex">
              {isReady ? (
                <FolderCheck
                  aria-hidden="true"
                  className="size-4 text-emerald-700"
                />
              ) : (
                <HardDrive aria-hidden="true" className="size-4" />
              )}
              {workspace
                ? `${workspace.name} · ${
                    isReady
                      ? '연결됨'
                      : needsInitialization
                        ? '초기화 필요'
                        : '권한 필요'
                  }`
                : '연결된 워크스페이스 없음'}
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              Phase 3 · File Tree
            </span>
          </header>

          <section className="grid flex-1 place-items-center px-5 py-12 sm:px-10">
            <div className="w-full max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">
                <span className="size-1.5 rounded-full bg-emerald-600" />
                설치 없이 Chrome에서 시작
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-6xl">
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
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                {needsInitialization
                  ? '기존 파일은 그대로 두고 Documents, Databases, Attachments와 앱 Metadata 폴더만 추가합니다.'
                  : isReady
                    ? selectedPath
                      ? `${selectedPath} 문서를 선택했습니다. 다음 Editor 단계에서 이 파일을 열고 편집할 수 있게 됩니다.`
                      : '왼쪽 파일 트리에서 폴더를 선택하고 새 Markdown 문서나 폴더를 만들 수 있습니다. 같은 이름의 기존 항목은 덮어쓰지 않습니다.'
                    : 'Markdown을 원본 그대로 유지하면서 문서와 데이터베이스를 한곳에서 관리하세요. 앱이 없어져도 파일은 언제나 사용자의 것입니다.'}
              </p>

              {isReady && workspace ? (
                <div className="mt-8 md:hidden">
                  <WorkspaceTree
                    entries={entries}
                    errorMessage={treeErrorMessage}
                    isLoading={treeStatus === 'loading'}
                    isMutating={mutationStatus === 'creating'}
                    key={`mobile-${workspace.manifest?.id ?? workspace.name}`}
                    mutationErrorMessage={mutationErrorMessage}
                    onClearMutationError={clearMutationError}
                    onCreateFolder={createFolder}
                    onCreateMarkdownFile={createMarkdownFile}
                    onDirectorySelect={selectDirectory}
                    onRefresh={() => void refreshWorkspace()}
                    onSelect={selectEntry}
                    selectedDirectoryPath={selectedDirectoryPath}
                    selectedPath={selectedPath}
                    workspaceName={workspace.name}
                  />
                </div>
              ) : null}

              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
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
                <p className="text-xs leading-5 text-stone-500">
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

              <dl className="mt-14 grid gap-3 border-t border-stone-200 pt-6 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-stone-500">
                    저장 위치
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    Local File System
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-stone-500">
                    원본 형식
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">표준 Markdown</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-stone-500">
                    지원 환경
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    Chrome · Windows · macOS
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </main>
      </div>
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
