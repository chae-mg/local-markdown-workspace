import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

interface UnsavedChangesDialogProps {
  documentName: string
  hasPreservationWarning?: boolean
  isOpen: boolean
  isSaving: boolean
  onCancel(): void
  onDiscard(): void
  onSave(): void
}

export function UnsavedChangesDialog({
  documentName,
  hasPreservationWarning = false,
  isOpen,
  isSaving,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onCancel])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 sm:p-6">
      <button
        aria-label="미저장 변경 확인 닫기"
        className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
        disabled={isSaving}
        onClick={onCancel}
        type="button"
      />
      <section
        aria-labelledby="unsaved-changes-title"
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_18px_60px_rgb(15_15_15/18%)]"
        role="dialog"
      >
        <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
            <AlertTriangle aria-hidden="true" className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <h2
              className="text-base font-semibold tracking-tight"
              id="unsaved-changes-title"
            >
              저장하지 않은 변경사항이 있습니다
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--ui-muted)]">
              <strong className="font-medium text-[var(--ui-text)]">
                {documentName}
              </strong>
              의 변경사항을 저장한 뒤 이동할까요?
            </p>
            {hasPreservationWarning ? (
              <p className="mt-2 text-xs leading-5 text-amber-800">
                시각 편집기가 일부 Markdown 표현을 정규화했습니다. 저장을
                선택하면 현재 변환 결과가 파일에 반영됩니다.
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[var(--ui-border)] bg-[var(--ui-sidebar)] px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Button
            autoFocus
            disabled={isSaving}
            onClick={onCancel}
            variant="outline"
          >
            취소
          </Button>
          <Button disabled={isSaving} onClick={onDiscard} variant="outline">
            저장하지 않고 이동
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            {isSaving
              ? '저장 중'
              : hasPreservationWarning
                ? '변환 결과 저장하고 이동'
                : '저장하고 이동'}
          </Button>
        </footer>
      </section>
    </div>
  )
}
