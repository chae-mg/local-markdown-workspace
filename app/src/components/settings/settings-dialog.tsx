import { RotateCcw, Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DOCUMENT_FONT_STACKS } from '@/app/theme-preferences'
import type {
  AccentPreset,
  AutosaveDelayMs,
  DefaultEditorMode,
  DocumentFontPreference,
  ThemePreference,
} from '@/domain/preferences'
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

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: '라이트', value: 'light' },
  { label: '다크', value: 'dark' },
  { label: '시스템', value: 'system' },
]

const accentOptions: Array<{
  color: string
  label: string
  value: AccentPreset
}> = [
  { color: '#2383E2', label: '파랑', value: 'blue' },
  { color: '#D9730D', label: '주황', value: 'orange' },
  { color: '#9065B0', label: '보라', value: 'purple' },
  {
    color: 'linear-gradient(135deg, #2F2F2D 50%, #F4F4F2 50%)',
    label: '검정/흰색',
    value: 'monochrome',
  },
  {
    color:
      'conic-gradient(from 45deg, #E03E3E, #D9730D, #DFAB01, #0F9D75, #2383E2, #9065B0, #E03E3E)',
    label: '커스텀',
    value: 'custom',
  },
]

const documentFontOptions: Array<{
  label: string
  sample: string
  value: DocumentFontPreference
}> = [
  { label: 'Notion 기본', sample: '가나다 Aa 123', value: 'notion' },
  { label: 'Pretendard', sample: '가나다 Aa 123', value: 'pretendard' },
  { label: '명조', sample: '가나다 Aa 123', value: 'serif' },
  { label: '고정폭', sample: '가나다 Aa 123', value: 'mono' },
]

const editorModeOptions: Array<{
  description: string
  label: string
  value: DefaultEditorMode
}> = [
  {
    description: '문서 형태로 바로 편집합니다.',
    label: '에디터',
    value: 'visual',
  },
  {
    description: 'Markdown 원문으로 시작합니다.',
    label: 'Markdown',
    value: 'source',
  },
]

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const {
    preferences,
    resetPreferences,
    setAccentPreset,
    setAutosaveDelay,
    setAutosaveEnabled,
    setCustomAccent,
    setDefaultEditorMode,
    setDocumentFont,
    setTheme,
    storageError,
  } = usePreferencesStore()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [customAccentDraft, setCustomAccentDraft] = useState(
    preferences.accent.customHex,
  )
  const [customAccentError, setCustomAccentError] = useState<string | null>(
    null,
  )

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

  const handleSaveCustomAccent = () => {
    if (!setCustomAccent(customAccentDraft.trim())) {
      setCustomAccentError('# 뒤에 여섯 자리 HEX 색상을 입력해 주세요.')
      return
    }

    setCustomAccentDraft(
      usePreferencesStore.getState().preferences.accent.customHex,
    )
    setCustomAccentError(null)
  }

  const handleResetPreferences = () => {
    resetPreferences()
    setCustomAccentDraft(
      usePreferencesStore.getState().preferences.accent.customHex,
    )
    setCustomAccentError(null)
  }

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
                  <span className="absolute top-1 left-1 size-4 rounded-full bg-[#fff] shadow-sm transition-transform peer-checked:translate-x-4" />
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

          <div className="mt-6">
            <p className="text-xs font-semibold text-[var(--ui-muted)]">화면</p>
            <div className="mt-2 rounded-lg border border-[var(--ui-border)] px-4 py-4">
              <div>
                <strong className="block text-sm font-medium">테마</strong>
                <p className="mt-1 text-xs leading-5 text-[var(--ui-muted)]">
                  현재 기기에서 사용할 화면 모드를 선택합니다.
                </p>
              </div>
              <div
                aria-label="테마"
                className="mt-3 grid grid-cols-3 gap-2"
                role="radiogroup"
              >
                {themeOptions.map((option) => {
                  const isSelected = preferences.theme === option.value
                  const previewClass =
                    option.value === 'light'
                      ? 'bg-[#fff]'
                      : option.value === 'dark'
                        ? 'bg-[#202020]'
                        : 'bg-[linear-gradient(90deg,#fff_50%,#202020_50%)]'

                  return (
                    <button
                      aria-checked={isSelected}
                      className={`min-w-0 rounded-lg border p-1 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--ui-accent)] ring-1 ring-[var(--ui-accent)]'
                          : 'border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]'
                      }`}
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      role="radio"
                      type="button"
                    >
                      <span
                        className={`relative block h-12 overflow-hidden rounded-[5px] shadow-[inset_0_0_0_1px_rgb(127_127_127/18%)] ${previewClass}`}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-[30%] ${
                            option.value === 'light'
                              ? 'bg-[#f0f0ee]'
                              : option.value === 'dark'
                                ? 'bg-[#292929]'
                                : 'bg-[linear-gradient(90deg,#f0f0ee_50%,#292929_50%)]'
                          }`}
                        />
                        <span className="absolute top-3.5 right-[12%] h-1 w-[45%] rounded-full bg-[#8a8a87]/45 shadow-[0_9px_0_rgb(138_138_135/45%),0_18px_0_rgb(138_138_135/45%)]" />
                      </span>
                      <span className="block truncate px-1 pt-1.5 pb-0.5 text-[11px] font-medium">
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 border-t border-[var(--ui-border)] pt-4">
                <strong className="block text-sm font-medium">키 컬러</strong>
                <p className="mt-1 text-xs leading-5 text-[var(--ui-muted)]">
                  버튼과 선택 상태에만 적용되며 문서 내용은 바꾸지 않습니다.
                </p>
                <div
                  aria-label="키 컬러"
                  className="mt-3 grid grid-cols-5 gap-1.5"
                  role="radiogroup"
                >
                  {accentOptions.map((option) => {
                    const isSelected =
                      preferences.accent.preset === option.value
                    const swatchColor =
                      option.value === 'custom'
                        ? preferences.accent.customHex
                        : option.color

                    return (
                      <button
                        aria-checked={isSelected}
                        className={`grid min-w-0 place-items-center gap-1.5 rounded-lg border px-1 py-2 text-[10px] font-medium transition-colors ${
                          isSelected
                            ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] text-[var(--ui-text)] ring-1 ring-[var(--ui-accent)]'
                            : 'border-transparent text-[var(--ui-muted)] hover:bg-[var(--ui-sidebar)] hover:text-[var(--ui-text)]'
                        }`}
                        key={option.value}
                        onClick={() => {
                          setAccentPreset(option.value)
                          setCustomAccentError(null)
                        }}
                        role="radio"
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="size-6 rounded-full border-2 border-[var(--ui-surface)] shadow-[0_0_0_1px_var(--ui-border-strong)]"
                          style={{ background: swatchColor }}
                        />
                        <span className="max-w-full truncate">
                          {option.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {preferences.accent.preset === 'custom' ? (
                  <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-sidebar)] p-3">
                    <label className="grid gap-1 text-[10px] font-semibold text-[var(--ui-muted)]">
                      색상
                      <input
                        aria-label="커스텀 키 컬러 선택"
                        className="h-8 w-11 cursor-pointer rounded-md border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] p-0.5"
                        onChange={(event) => {
                          setCustomAccentDraft(event.target.value.toUpperCase())
                          setCustomAccentError(null)
                        }}
                        type="color"
                        value={
                          /^#[0-9a-f]{6}$/i.test(customAccentDraft)
                            ? customAccentDraft
                            : preferences.accent.customHex
                        }
                      />
                    </label>
                    <label className="grid min-w-0 gap-1 text-[10px] font-semibold text-[var(--ui-muted)]">
                      HEX
                      <input
                        aria-describedby="custom-accent-error"
                        aria-invalid={Boolean(customAccentError)}
                        className="h-8 min-w-0 rounded-md border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-2 font-mono text-xs font-normal text-[var(--ui-text)] uppercase outline-none aria-invalid:border-[var(--ui-danger)]"
                        maxLength={7}
                        onChange={(event) => {
                          setCustomAccentDraft(event.target.value.toUpperCase())
                          setCustomAccentError(null)
                        }}
                        spellCheck={false}
                        value={customAccentDraft}
                      />
                    </label>
                    <Button onClick={handleSaveCustomAccent} size="sm">
                      컬러 저장
                    </Button>
                    <p
                      className="col-start-2 col-end-4 min-h-4 text-[10px] text-[var(--ui-danger)]"
                      id="custom-accent-error"
                      role={customAccentError ? 'alert' : undefined}
                    >
                      {customAccentError}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold text-[var(--ui-muted)]">문서</p>
            <div className="mt-2 rounded-lg border border-[var(--ui-border)] px-4 py-4">
              <div>
                <strong className="block text-sm font-medium">문서 글꼴</strong>
                <p className="mt-1 text-xs leading-5 text-[var(--ui-muted)]">
                  편집기와 데이터베이스 내용에만 적용됩니다.
                </p>
              </div>
              <div
                aria-label="문서 글꼴"
                className="mt-3 grid grid-cols-2 gap-2"
                role="radiogroup"
              >
                {documentFontOptions.map((option) => {
                  const isSelected = preferences.documentFont === option.value

                  return (
                    <button
                      aria-checked={isSelected}
                      aria-label={option.label}
                      className={`min-w-0 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-accent)]'
                          : 'border-[var(--ui-border)] hover:border-[var(--ui-border-strong)] hover:bg-[var(--ui-sidebar)]'
                      }`}
                      key={option.value}
                      onClick={() => setDocumentFont(option.value)}
                      role="radio"
                      type="button"
                    >
                      <span className="block text-xs font-medium">
                        {option.label}
                      </span>
                      <span
                        className="mt-1.5 block truncate text-sm text-[var(--ui-muted)]"
                        style={{
                          fontFamily: DOCUMENT_FONT_STACKS[option.value],
                        }}
                      >
                        {option.sample}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 border-t border-[var(--ui-border)] pt-4">
                <strong className="block text-sm font-medium">
                  기본 편집 모드
                </strong>
                <p className="mt-1 text-xs leading-5 text-[var(--ui-muted)]">
                  다음에 여는 문서부터 선택한 모드로 시작합니다.
                </p>
                <div
                  aria-label="기본 편집 모드"
                  className="mt-3 grid grid-cols-2 gap-2"
                  role="radiogroup"
                >
                  {editorModeOptions.map((option) => {
                    const isSelected =
                      preferences.defaultEditorMode === option.value

                    return (
                      <button
                        aria-checked={isSelected}
                        aria-label={option.label}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-accent)]'
                            : 'border-[var(--ui-border)] hover:border-[var(--ui-border-strong)] hover:bg-[var(--ui-sidebar)]'
                        }`}
                        key={option.value}
                        onClick={() => setDefaultEditorMode(option.value)}
                        role="radio"
                        type="button"
                      >
                        <span className="block text-xs font-medium">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-[var(--ui-muted)]">
                          {option.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
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
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--ui-border)] px-5 py-3 sm:px-6">
          <button
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
            onClick={handleResetPreferences}
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
