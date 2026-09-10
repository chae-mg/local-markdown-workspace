import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Code2,
  FileText,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Save,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Button } from '@/components/ui/button'
import { MarkdownError } from '@/domain/markdown'
import { attachmentService } from '@/app/composition-root'
import { markdownService } from '@/services/markdown.service'
import { useDocumentStore } from '@/stores/document.store'

const VisualMarkdownEditor = lazy(() =>
  import('@/components/editor/visual-markdown-editor').then((module) => ({
    default: module.VisualMarkdownEditor,
  })),
)

interface DocumentEditorProps {
  onClose(): void
  path: string
}

function comparableMarkdown(source: string) {
  return source.replaceAll('\r\n', '\n').trim()
}

function fileNameFromPath(path: string) {
  return path.split('/').at(-1) ?? path
}

export function DocumentEditor({ onClose, path }: DocumentEditorProps) {
  const {
    document,
    draftSource,
    editorMode,
    errorMessage,
    forceSave,
    openDocument,
    preservationWarning,
    reloadDocument,
    saveDocument,
    setEditorMode,
    setPreservationWarning,
    status,
    updateDraft,
  } = useDocumentStore()
  const [showNormalizationConfirmation, setShowNormalizationConfirmation] =
    useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [isSavingAttachment, setIsSavingAttachment] = useState(false)
  const [visualEditorRevision, setVisualEditorRevision] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null)
  const documentPath = document?.path ?? path

  useEffect(() => {
    void openDocument(path)

    return () => useDocumentStore.getState().closeDocument()
  }, [openDocument, path])

  const parsedDocument = useMemo(() => {
    try {
      return { error: null, value: markdownService.parseDocument(draftSource) }
    } catch (error) {
      return {
        error:
          error instanceof MarkdownError
            ? error.message
            : 'Markdown 문서를 해석할 수 없습니다.',
        value: null,
      }
    }
  }, [draftSource])

  useEffect(() => {
    if (parsedDocument.error && editorMode === 'visual') {
      setEditorMode('source')
    }
  }, [editorMode, parsedDocument.error, setEditorMode])

  const isDirty = document !== null && draftSource !== document.source
  const autoSaveBlocked = preservationWarning

  useEffect(() => {
    if (!isDirty || status !== 'ready' || autoSaveBlocked) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void useDocumentStore.getState().saveDocument()
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [autoSaveBlocked, draftSource, isDirty, status])

  const handleVisualChange = useCallback((body: string) => {
    const currentSource = useDocumentStore.getState().draftSource

    try {
      const currentDocument = markdownService.parseDocument(currentSource)
      useDocumentStore
        .getState()
        .updateDraft(
          markdownService.serializeDocument({ ...currentDocument, body }),
        )
    } catch {
      useDocumentStore.getState().setEditorMode('source')
    }
  }, [])

  const handleVisualReady = useCallback(
    (normalizedBody: string) => {
      if (!parsedDocument.value) {
        return
      }

      setPreservationWarning(
        comparableMarkdown(normalizedBody) !==
          comparableMarkdown(parsedDocument.value.body),
      )
    },
    [parsedDocument.value, setPreservationWarning],
  )

  const uploadImage = useCallback(
    async (file: File) => {
      setAttachmentError(null)
      setIsSavingAttachment(true)
      try {
        const attachment = await attachmentService.saveAttachment(
          documentPath,
          file,
        )
        return attachment.relativePath
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '이미지를 저장하지 못했습니다.'
        setAttachmentError(message)
        throw error
      } finally {
        setIsSavingAttachment(false)
      }
    },
    [documentPath],
  )

  const resolveAttachmentFile = useCallback(
    (url: string) => attachmentService.readAttachment(documentPath, url),
    [documentPath],
  )

  const insertAttachmentMarkdown = useCallback(
    (markdownBlocks: string[]) => {
      if (markdownBlocks.length === 0) {
        return
      }

      const currentSource = useDocumentStore.getState().draftSource
      const insertion = markdownBlocks.join('\n\n')

      if (editorMode === 'source') {
        const textarea = sourceTextareaRef.current
        const start = textarea?.selectionStart ?? currentSource.length
        const end = textarea?.selectionEnd ?? start
        const before = currentSource.slice(0, start)
        const after = currentSource.slice(end)
        const prefix = before
          ? before.endsWith('\n\n')
            ? ''
            : before.endsWith('\n')
              ? '\n'
              : '\n\n'
          : ''
        const suffix = after
          ? after.startsWith('\n\n')
            ? ''
            : after.startsWith('\n')
              ? '\n'
              : '\n\n'
          : ''
        const nextSource = `${before}${prefix}${insertion}${suffix}${after}`
        updateDraft(nextSource)

        window.requestAnimationFrame(() => {
          const cursor = start + prefix.length + insertion.length
          sourceTextareaRef.current?.focus()
          sourceTextareaRef.current?.setSelectionRange(cursor, cursor)
        })
        return
      }

      try {
        const currentDocument = markdownService.parseDocument(currentSource)
        const separator = currentDocument.body
          ? currentDocument.body.endsWith('\n\n')
            ? ''
            : currentDocument.body.endsWith('\n')
              ? '\n'
              : '\n\n'
          : ''
        updateDraft(
          markdownService.serializeDocument({
            ...currentDocument,
            body: `${currentDocument.body}${separator}${insertion}`,
          }),
        )
        setVisualEditorRevision((revision) => revision + 1)
      } catch (error) {
        setAttachmentError(
          error instanceof Error
            ? error.message
            : '첨부 파일 링크를 문서에 넣지 못했습니다.',
        )
      }
    },
    [editorMode, updateDraft],
  )

  const saveAttachments = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || status !== 'ready') {
        return
      }

      setAttachmentError(null)
      setIsSavingAttachment(true)
      const markdownBlocks: string[] = []
      try {
        for (const file of files) {
          const attachment = await attachmentService.saveAttachment(
            documentPath,
            file,
          )
          markdownBlocks.push(attachment.markdown)
        }
      } catch (error) {
        setAttachmentError(
          error instanceof Error
            ? error.message
            : '첨부 파일을 저장하지 못했습니다.',
        )
      } finally {
        insertAttachmentMarkdown(markdownBlocks)
        setIsSavingAttachment(false)
      }
    },
    [documentPath, insertAttachmentMarkdown, status],
  )

  const handleDropCapture = (event: DragEvent<HTMLElement>) => {
    const files = Array.from(event.dataTransfer.files)
    if (
      files.length === 0 ||
      (editorMode === 'visual' &&
        files.every((file) => file.type.startsWith('image/')))
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    void saveAttachments(files)
  }

  const handleSourcePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) {
      return
    }

    event.preventDefault()
    void saveAttachments(files)
  }

  const handleSave = () => {
    if (preservationWarning && editorMode === 'visual') {
      setShowNormalizationConfirmation(true)
      return
    }

    setPreservationWarning(false)
    void saveDocument()
  }

  const statusLabel =
    status === 'saving'
      ? '저장 중'
      : status === 'conflict'
        ? '외부 변경 감지'
        : status === 'error'
          ? '저장 오류'
          : isDirty
            ? autoSaveBlocked
              ? '저장 확인 필요'
              : '자동 저장 대기'
            : '저장됨'

  if (status === 'loading') {
    return (
      <section className="grid flex-1 place-items-center p-8">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          문서를 여는 중입니다.
        </div>
      </section>
    )
  }

  if (!document) {
    return (
      <section className="grid flex-1 place-items-center p-8">
        <div className="max-w-md text-center">
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto size-5 text-red-700"
          />
          <p className="mt-3 text-sm text-red-800">{errorMessage}</p>
          <Button className="mt-4" onClick={() => void openDocument(path)}>
            다시 시도
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-stone-50/40">
      <div className="flex flex-col gap-4 border-b border-stone-200 bg-white px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label="문서 목록으로 돌아가기"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 md:hidden"
            onClick={onClose}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText aria-hidden="true" className="size-4 text-stone-500" />
              <h1 className="truncate text-base font-semibold tracking-tight">
                {fileNameFromPath(document.path)}
              </h1>
            </div>
            <p className="mt-1 truncate text-xs text-stone-500">
              {document.path}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="편집 모드"
            className="flex rounded-xl border border-stone-200 bg-stone-100 p-1"
            role="group"
          >
            <button
              aria-pressed={editorMode === 'visual'}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                editorMode === 'visual'
                  ? 'bg-white text-stone-950 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              disabled={Boolean(parsedDocument.error)}
              onClick={() => setEditorMode('visual')}
              type="button"
            >
              <FileText aria-hidden="true" className="size-3.5" />
              에디터
            </button>
            <button
              aria-pressed={editorMode === 'source'}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                editorMode === 'source'
                  ? 'bg-white text-stone-950 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              onClick={() => setEditorMode('source')}
              type="button"
            >
              <Code2 aria-hidden="true" className="size-3.5" />
              Markdown
            </button>
          </div>

          <span
            aria-live="polite"
            className={`flex items-center gap-1.5 text-xs ${
              status === 'conflict' || status === 'error'
                ? 'text-red-700'
                : 'text-stone-500'
            }`}
          >
            {status === 'saving' ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
            ) : !isDirty && status === 'ready' ? (
              <Check aria-hidden="true" className="size-3.5 text-emerald-700" />
            ) : null}
            {statusLabel}
          </span>
          <input
            className="sr-only"
            multiple
            onChange={(event) => {
              void saveAttachments(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
          <Button
            disabled={
              status !== 'ready' || isSavingAttachment || preservationWarning
            }
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
          >
            {isSavingAttachment ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
            ) : (
              <Paperclip aria-hidden="true" className="size-3.5" />
            )}
            {isSavingAttachment ? '첨부 중' : '첨부'}
          </Button>
          <Button
            disabled={!isDirty || status === 'saving' || status === 'conflict'}
            onClick={handleSave}
            size="sm"
          >
            <Save aria-hidden="true" className="size-3.5" />
            저장
          </Button>
        </div>
      </div>

      {status === 'conflict' ? (
        <div
          className="flex flex-col gap-3 border-b border-red-200 bg-red-50 px-5 py-4 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between sm:px-8"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <p>{errorMessage}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              onClick={() => void reloadDocument()}
              size="sm"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              디스크 버전 다시 불러오기
            </Button>
            <Button onClick={() => void forceSave()} size="sm">
              현재 편집본으로 덮어쓰기
            </Button>
          </div>
        </div>
      ) : null}

      {status === 'error' ? (
        <div
          className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-950 sm:px-8"
          role="alert"
        >
          <span>{errorMessage}</span>
          <Button
            onClick={() => void saveDocument()}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            다시 저장
          </Button>
        </div>
      ) : null}

      {attachmentError ? (
        <div
          className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-950 sm:px-8"
          role="alert"
        >
          {attachmentError}
        </div>
      ) : null}

      {parsedDocument.error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:px-8">
          Frontmatter를 해석할 수 없어 Markdown 원문 모드로 열었습니다.{' '}
          {parsedDocument.error}
        </div>
      ) : null}

      {preservationWarning ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:px-8">
          시각 편집기가 원문의 일부 표현을 정규화할 수 있어 자동 저장을
          멈췄습니다.{' '}
          {editorMode === 'visual'
            ? '원문을 보존하려면 Markdown 모드에서 확인하세요.'
            : '변경 내용을 확인한 뒤 저장 버튼을 눌러주세요.'}
        </div>
      ) : null}

      {showNormalizationConfirmation ? (
        <div
          className="flex flex-col gap-3 border-b border-amber-300 bg-amber-100 px-5 py-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:px-8"
          role="alertdialog"
        >
          <p>시각 편집기의 Markdown 변환 결과로 저장할까요?</p>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowNormalizationConfirmation(false)}
              size="sm"
              variant="outline"
            >
              취소
            </Button>
            <Button
              onClick={() => {
                setShowNormalizationConfirmation(false)
                setPreservationWarning(false)
                void saveDocument()
              }}
              size="sm"
            >
              변환 결과 저장
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-auto p-3 sm:p-6"
        onDropCapture={handleDropCapture}
      >
        <div className="mx-auto min-h-full max-w-4xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {editorMode === 'visual' && parsedDocument.value ? (
            <Suspense
              fallback={
                <div className="grid min-h-[34rem] place-items-center text-stone-500">
                  <LoaderCircle
                    aria-label="시각 편집기 불러오는 중"
                    className="size-4 animate-spin"
                  />
                </div>
              }
            >
              <VisualMarkdownEditor
                disabled={status === 'saving' || status === 'conflict'}
                initialMarkdown={parsedDocument.value.body}
                key={visualEditorRevision}
                onChange={handleVisualChange}
                onReady={handleVisualReady}
                onUploadImage={uploadImage}
                resolveAttachmentFile={resolveAttachmentFile}
              />
            </Suspense>
          ) : (
            <textarea
              aria-label="Markdown 원문"
              className="min-h-[40rem] w-full resize-none bg-white px-6 py-8 font-mono text-[15px] leading-7 text-stone-900 outline-none sm:px-10"
              disabled={status === 'saving' || status === 'conflict'}
              onChange={(event) => updateDraft(event.target.value)}
              onPaste={handleSourcePaste}
              ref={sourceTextareaRef}
              spellCheck={false}
              value={draftSource}
            />
          )}
        </div>
      </div>
    </section>
  )
}
