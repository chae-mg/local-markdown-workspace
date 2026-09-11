import { RotateCcw, Settings2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import type { AutosaveDelayMs } from '@/domain/preferences'
import { usePreferencesStore } from '@/stores/preferences.store'

interface SettingsDialogProps {
  isOpen: boolean
  onClose(): void
}

const autosaveDelayOptions: Array<{
  label: string
  value: AutosaveDelayMs
}> = [
  { label: '1초', value: 1000 },
  { label: '3초', value: 3000 },
  { label: '5초', value: 5000 },
]

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const {
    preferences,
    resetPreferences,
    setAutosaveDelay,
    setAutosaveEnabled,
    storageError,
  } = usePreferencesStore()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6">
      <button
        aria-label="설정 바깥 영역 닫기"
        className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby="settings-title"
        aria-modal="true"
        className="relative flex max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_18px_60px_rgb(15_15_15/18%)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
              <Settings2 aria-hidden="true" className="size-[18px]" />
            </div>
            <div>
              <h2
                className="text-base font-semibold tracking-tight"
                id="settings-title"
              >
                나에게 맞게 조정하기
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--ui-muted)]">
                설정은 현재 브라우저에만 저장되며 워크스페이스 파일은 변경하지
                않습니다.
              </p>
            </div>
          </div>
          <button
            aria-label="설정 닫기"
            className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold text-[var(--ui-muted)]">저장</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-[var(--ui-border)]">
              <label className="flex cursor-pointer items-center justify-between gap-5 px-4 py-3.5 hover:bg-[var(--ui-sidebar)]">
                <span>
                  <strong className="block text-sm font-medium">
                    자동 저장
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-[var(--ui-muted)]">
                    입력을 멈춘 뒤 선택한 시간이 지나면 문서를 저장합니다.
                  </span>
                </span>
                <span className="relative shrink-0">
                  <input
                    aria-label="자동 저장 사용"
                    checked={preferences.autosave.enabled}
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                    onChange={(event) =>
                      setAutosaveEnabled(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span className="block h-6 w-10 rounded-full bg-[var(--ui-border-strong)] transition-colors peer-checked:bg-[var(--ui-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ui-accent)] peer-focus-visible:ring-offset-2" />
                  <span className="absolute top-1 left-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                </span>
              </label>

              <div className="flex items-center justify-between gap-5 border-t border-[var(--ui-border)] px-4 py-3.5">
                <label className="text-sm font-medium" htmlFor="autosave-delay">
                  자동 저장 간격
                </label>
                <select
                  className="h-8 min-w-24 rounded-md border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!preferences.autosave.enabled}
                  id="autosave-delay"
                  onChange={(event) =>
                    setAutosaveDelay(
                      Number(event.target.value) as AutosaveDelayMs,
                    )
                  }
                  value={preferences.autosave.delayMs}
                >
                  {autosaveDelayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {storageError ? (
            <p
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
              role="alert"
            >
              {storageError} 변경 내용은 현재 화면에서는 유지됩니다.
            </p>
          ) : null}

          <div className="mt-5 rounded-lg bg-[var(--ui-sidebar)] px-4 py-3 text-xs leading-5 text-[var(--ui-muted)]">
            테마, 키 컬러와 문서 글꼴은 각 화면에 일관되게 적용하는 다음
            단계에서 추가됩니다.
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--ui-border)] px-5 py-3 sm:px-6">
          <button
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
            onClick={resetPreferences}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            기본값 복원
          </button>
          <Button onClick={onClose} size="sm">
            완료
          </Button>
        </footer>
      </section>
    </div>
  )
}
