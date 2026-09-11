import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { schemaService } from '@/app/composition-root'
import { Button } from '@/components/ui/button'
import type {
  DatabaseSchema,
  PropertyDefinition,
  PropertyType,
  SelectOption,
} from '@/domain/database'
import type { SchemaApplicationService } from '@/services/schema.service'

const propertyTypeLabels: Record<PropertyType, string> = {
  text: '텍스트',
  number: '숫자',
  select: '선택',
  multi_select: '다중 선택',
  checkbox: '체크박스',
  date: '날짜',
}

interface RenameTarget {
  kind: 'property' | 'option'
  propertyId: string
  optionId?: string
  value: string
}

interface SchemaPropertyManagerProps {
  database: DatabaseSchema
  onChange(schema: DatabaseSchema): void
  service?: SchemaApplicationService
}

function isSelectProperty(
  property: PropertyDefinition,
): property is Extract<
  PropertyDefinition,
  { type: 'select' | 'multi_select' }
> {
  return property.type === 'select' || property.type === 'multi_select'
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Schema를 변경하는 중 알 수 없는 오류가 발생했습니다.'
}

export function SchemaPropertyManager({
  database,
  onChange,
  service = schemaService,
}: SchemaPropertyManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Set<string>>(
    new Set(),
  )
  const [propertyName, setPropertyName] = useState('')
  const [propertyType, setPropertyType] = useState<PropertyType>('text')
  const [optionNames, setOptionNames] = useState<Record<string, string>>({})
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const properties = Object.values(database.properties).sort(
    (left, right) => left.order - right.order,
  )
  const activeProperties = properties.filter((property) => !property.deleted)
  const deletedProperties = properties.filter((property) => property.deleted)

  const runMutation = async (operation: () => Promise<DatabaseSchema>) => {
    if (isMutating) {
      return false
    }
    setIsMutating(true)
    setErrorMessage(null)
    try {
      onChange(await operation())
      setIsMutating(false)
      return true
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setIsMutating(false)
      return false
    }
  }

  const handleCreateProperty = async (event: FormEvent) => {
    event.preventDefault()
    if (!propertyName.trim()) {
      return
    }
    if (
      await runMutation(() =>
        service.createProperty(database.id, propertyName, propertyType),
      )
    ) {
      setPropertyName('')
      setPropertyType('text')
      setShowCreateForm(false)
    }
  }

  const handleRename = async (event: FormEvent) => {
    event.preventDefault()
    if (!renameTarget?.value.trim()) {
      return
    }
    const succeeded = await runMutation(() =>
      renameTarget.kind === 'property'
        ? service.renameProperty(
            database.id,
            renameTarget.propertyId,
            renameTarget.value,
          )
        : service.renameOption(
            database.id,
            renameTarget.propertyId,
            renameTarget.optionId ?? '',
            renameTarget.value,
          ),
    )
    if (succeeded) {
      setRenameTarget(null)
    }
  }

  const handleAddOption = async (
    event: FormEvent,
    property: PropertyDefinition,
  ) => {
    event.preventDefault()
    const name = optionNames[property.id]?.trim()
    if (!name) {
      return
    }
    if (
      await runMutation(() => service.addOption(database.id, property.id, name))
    ) {
      setOptionNames((current) => ({ ...current, [property.id]: '' }))
    }
  }

  const toggleExpanded = (propertyId: string) => {
    setExpandedPropertyIds((current) => {
      const next = new Set(current)
      if (next.has(propertyId)) {
        next.delete(propertyId)
      } else {
        next.add(propertyId)
      }
      return next
    })
  }

  const renderRenameForm = () => (
    <form
      className="flex min-w-0 flex-1 items-center gap-1.5"
      onSubmit={(event) => void handleRename(event)}
    >
      <label className="sr-only" htmlFor="schema-rename-input">
        새 이름
      </label>
      <input
        autoFocus
        className="h-8 min-w-0 flex-1 rounded-lg border border-stone-300 px-2 text-xs outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
        disabled={isMutating}
        id="schema-rename-input"
        onChange={(event) =>
          setRenameTarget((current) =>
            current ? { ...current, value: event.target.value } : null,
          )
        }
        value={renameTarget?.value ?? ''}
      />
      <button
        aria-label="이름 변경 저장"
        className="grid size-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50"
        disabled={isMutating || !renameTarget?.value.trim()}
        type="submit"
      >
        <Check aria-hidden="true" className="size-3.5" />
      </button>
      <button
        aria-label="이름 변경 취소"
        className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
        disabled={isMutating}
        onClick={() => setRenameTarget(null)}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </form>
  )

  const renderOption = (property: PropertyDefinition, option: SelectOption) => {
    const isRenaming =
      renameTarget?.kind === 'option' &&
      renameTarget.propertyId === property.id &&
      renameTarget.optionId === option.id

    return (
      <div
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
          option.deleted
            ? 'border-stone-200 bg-stone-50 text-stone-400'
            : 'border-stone-200 bg-white text-stone-700'
        }`}
        key={option.id}
      >
        {isRenaming ? (
          renderRenameForm()
        ) : (
          <>
            <span
              className={`min-w-0 flex-1 truncate ${option.deleted ? 'line-through' : ''}`}
            >
              {option.name}
            </span>
            <code className="hidden text-[10px] text-stone-400 sm:block">
              {option.id}
            </code>
            {option.deleted ? (
              <button
                aria-label={`${option.name} Option 복원`}
                className="grid size-7 place-items-center rounded-md hover:bg-stone-200 hover:text-stone-700"
                disabled={isMutating}
                onClick={() =>
                  void runMutation(() =>
                    service.restoreOption(database.id, property.id, option.id),
                  )
                }
                type="button"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </button>
            ) : (
              <>
                <button
                  aria-label={`${option.name} Option 이름 변경`}
                  className="grid size-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  disabled={isMutating}
                  onClick={() =>
                    setRenameTarget({
                      kind: 'option',
                      propertyId: property.id,
                      optionId: option.id,
                      value: option.name,
                    })
                  }
                  type="button"
                >
                  <Pencil aria-hidden="true" className="size-3" />
                </button>
                <button
                  aria-label={`${option.name} Option 삭제`}
                  className="grid size-7 place-items-center rounded-md text-stone-400 hover:bg-red-50 hover:text-red-700"
                  disabled={isMutating}
                  onClick={() =>
                    void runMutation(() =>
                      service.softDeleteOption(
                        database.id,
                        property.id,
                        option.id,
                      ),
                    )
                  }
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="border-b border-stone-200 bg-stone-50/60 px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings2 aria-hidden="true" className="size-4 text-stone-500" />
          <h3 className="text-sm font-semibold">속성 관리</h3>
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
            {activeProperties.length}
          </span>
        </div>
        <Button
          disabled={isMutating}
          onClick={() => setShowCreateForm((visible) => !visible)}
          size="sm"
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          속성 추가
        </Button>
      </div>

      {errorMessage ? (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {showCreateForm ? (
        <form
          className="mt-3 grid gap-2 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
          onSubmit={(event) => void handleCreateProperty(event)}
        >
          <label className="sr-only" htmlFor="property-name">
            새 속성 이름
          </label>
          <input
            autoFocus
            className="h-9 min-w-0 rounded-lg border border-stone-300 px-2.5 text-xs outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
            disabled={isMutating}
            id="property-name"
            onChange={(event) => setPropertyName(event.target.value)}
            placeholder="예: 우선순위"
            value={propertyName}
          />
          <label className="sr-only" htmlFor="property-type">
            새 속성 타입
          </label>
          <select
            className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-xs outline-none focus:border-stone-500"
            disabled={isMutating}
            id="property-type"
            onChange={(event) =>
              setPropertyType(event.target.value as PropertyType)
            }
            value={propertyType}
          >
            {Object.entries(propertyTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
          <Button
            disabled={isMutating || !propertyName.trim()}
            size="sm"
            type="submit"
          >
            추가
          </Button>
        </form>
      ) : null}

      {activeProperties.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-5 text-center text-xs leading-5 text-stone-500">
          아직 속성이 없습니다. 여섯 가지 기본 타입으로 첫 속성을 추가해보세요.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {activeProperties.map((property, index) => {
            const isExpanded = expandedPropertyIds.has(property.id)
            const isRenaming =
              renameTarget?.kind === 'property' &&
              renameTarget.propertyId === property.id
            return (
              <div
                className="rounded-xl border border-stone-200 bg-white"
                key={property.id}
              >
                <div className="flex flex-wrap items-center gap-2 p-2.5">
                  {isSelectProperty(property) ? (
                    <button
                      aria-label={`${property.name} Option 펼치기`}
                      aria-expanded={isExpanded}
                      className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                      onClick={() => toggleExpanded(property.id)}
                      type="button"
                    >
                      {isExpanded ? (
                        <ChevronDown aria-hidden="true" className="size-4" />
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-4" />
                      )}
                    </button>
                  ) : (
                    <span className="size-8" />
                  )}

                  {isRenaming ? (
                    renderRenameForm()
                  ) : (
                    <div className="min-w-32 flex-1">
                      <p className="truncate text-xs font-medium text-stone-900">
                        {property.name}
                      </p>
                      <code className="text-[10px] text-stone-400">
                        {property.id}
                      </code>
                    </div>
                  )}

                  {!isRenaming ? (
                    <>
                      <label
                        className="sr-only"
                        htmlFor={`type-${property.id}`}
                      >
                        {property.name} 타입
                      </label>
                      <select
                        className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2 text-[11px] text-stone-600 outline-none focus:border-stone-400"
                        disabled={isMutating}
                        id={`type-${property.id}`}
                        onChange={(event) =>
                          void runMutation(() =>
                            service.changePropertyType(
                              database.id,
                              property.id,
                              event.target.value as PropertyType,
                            ),
                          )
                        }
                        value={property.type}
                      >
                        {Object.entries(propertyTypeLabels).map(
                          ([type, label]) => (
                            <option key={type} value={type}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <div className="flex items-center">
                        <button
                          aria-label={`${property.name} 위로 이동`}
                          className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          disabled={isMutating || index === 0}
                          onClick={() =>
                            void runMutation(() =>
                              service.moveProperty(
                                database.id,
                                property.id,
                                'up',
                              ),
                            )
                          }
                          type="button"
                        >
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          aria-label={`${property.name} 아래로 이동`}
                          className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          disabled={
                            isMutating || index === activeProperties.length - 1
                          }
                          onClick={() =>
                            void runMutation(() =>
                              service.moveProperty(
                                database.id,
                                property.id,
                                'down',
                              ),
                            )
                          }
                          type="button"
                        >
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          aria-label={`${property.name} 이름 변경`}
                          className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          disabled={isMutating}
                          onClick={() =>
                            setRenameTarget({
                              kind: 'property',
                              propertyId: property.id,
                              value: property.name,
                            })
                          }
                          type="button"
                        >
                          <Pencil aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          aria-label={`${property.name} 속성 삭제`}
                          className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700"
                          disabled={isMutating}
                          onClick={() =>
                            void runMutation(() =>
                              service.softDeleteProperty(
                                database.id,
                                property.id,
                              ),
                            )
                          }
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>

                {isSelectProperty(property) && isExpanded ? (
                  <div className="border-t border-stone-100 bg-stone-50/60 px-3 py-3">
                    <div className="space-y-1.5">
                      {property.options.map((option) =>
                        renderOption(property, option),
                      )}
                    </div>
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(event) =>
                        void handleAddOption(event, property)
                      }
                    >
                      <label
                        className="sr-only"
                        htmlFor={`option-${property.id}`}
                      >
                        {property.name} 새 Option 이름
                      </label>
                      <input
                        className="h-8 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2 text-xs outline-none focus:border-stone-500"
                        disabled={isMutating}
                        id={`option-${property.id}`}
                        onChange={(event) =>
                          setOptionNames((current) => ({
                            ...current,
                            [property.id]: event.target.value,
                          }))
                        }
                        placeholder="새 Option"
                        value={optionNames[property.id] ?? ''}
                      />
                      <Button
                        disabled={
                          isMutating || !optionNames[property.id]?.trim()
                        }
                        size="sm"
                        type="submit"
                        variant="outline"
                      >
                        추가
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {deletedProperties.length > 0 ? (
        <div className="mt-3">
          <button
            aria-expanded={showDeleted}
            className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
            onClick={() => setShowDeleted((visible) => !visible)}
            type="button"
          >
            {showDeleted ? (
              <ChevronDown aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-3.5" />
            )}
            삭제된 속성 {deletedProperties.length}개
          </button>
          {showDeleted ? (
            <div className="mt-2 space-y-1.5">
              {deletedProperties.map((property) => (
                <div
                  className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs text-stone-400"
                  key={property.id}
                >
                  <span className="min-w-0 flex-1 truncate line-through">
                    {property.name}
                  </span>
                  <span>{propertyTypeLabels[property.type]}</span>
                  <button
                    aria-label={`${property.name} 속성 복원`}
                    className="grid size-7 place-items-center rounded-md hover:bg-white hover:text-stone-700"
                    disabled={isMutating}
                    onClick={() =>
                      void runMutation(() =>
                        service.restoreProperty(database.id, property.id),
                      )
                    }
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
