import { create } from 'zustand'

import { documentService } from '@/app/composition-root'
import { DocumentConflictError, type DocumentSnapshot } from '@/domain/document'
import type { DocumentApplicationService } from '@/services/document.service'

export type DocumentEditorMode = 'visual' | 'source'
export type DocumentStatus =
  'idle' | 'loading' | 'ready' | 'saving' | 'conflict' | 'error'

export interface DocumentStore {
  document: DocumentSnapshot | null
  draftSource: string
  editorMode: DocumentEditorMode
  errorMessage: string | null
  preservationWarning: boolean
  status: DocumentStatus
  closeDocument(): void
  forceSave(): Promise<boolean>
  openDocument(path: string): Promise<void>
  reloadDocument(): Promise<void>
  saveDocument(): Promise<boolean>
  setEditorMode(mode: DocumentEditorMode): void
  setPreservationWarning(value: boolean): void
  updateDraft(source: string): void
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : '문서를 처리하는 중 알 수 없는 오류가 발생했습니다.'
}

export function createDocumentStore(service: DocumentApplicationService) {
  let openRequestId = 0

  return create<DocumentStore>((set, get) => {
    async function persist(force: boolean) {
      const state = get()
      const document = state.document

      if (
        !document ||
        state.status === 'loading' ||
        state.status === 'saving' ||
        (!force && state.status === 'conflict')
      ) {
        return false
      }

      if (!force && state.draftSource === document.source) {
        return true
      }

      const path = document.path
      const draftSource = state.draftSource
      set({ errorMessage: null, status: 'saving' })

      try {
        const savedDocument = await service.saveDocument({
          expectedLastModified: document.lastModified,
          expectedSource: document.source,
          force,
          path,
          source: draftSource,
        })

        if (get().document?.path === path) {
          set({
            document: savedDocument,
            draftSource:
              get().draftSource === draftSource
                ? savedDocument.source
                : get().draftSource,
            errorMessage: null,
            status: 'ready',
          })
        }
        return true
      } catch (error) {
        if (get().document?.path !== path) {
          return false
        }

        if (error instanceof DocumentConflictError) {
          set({ errorMessage: error.message, status: 'conflict' })
        } else {
          set({ errorMessage: messageFromError(error), status: 'error' })
        }
        return false
      }
    }

    return {
      document: null,
      draftSource: '',
      editorMode: 'visual',
      errorMessage: null,
      preservationWarning: false,
      status: 'idle',

      closeDocument() {
        openRequestId += 1
        set({
          document: null,
          draftSource: '',
          editorMode: 'visual',
          errorMessage: null,
          preservationWarning: false,
          status: 'idle',
        })
      },

      forceSave() {
        return persist(true)
      },

      async openDocument(path) {
        const requestId = ++openRequestId
        set({
          document: null,
          draftSource: '',
          editorMode: 'visual',
          errorMessage: null,
          preservationWarning: false,
          status: 'loading',
        })

        try {
          const document = await service.openDocument(path)
          if (requestId !== openRequestId || get().status !== 'loading') {
            return
          }
          set({ document, draftSource: document.source, status: 'ready' })
        } catch (error) {
          if (requestId !== openRequestId || get().status !== 'loading') {
            return
          }
          set({ errorMessage: messageFromError(error), status: 'error' })
        }
      },

      async reloadDocument() {
        const path = get().document?.path
        if (path) {
          await get().openDocument(path)
        }
      },

      saveDocument() {
        return persist(false)
      },

      setEditorMode(editorMode) {
        set({ editorMode })
      },

      setPreservationWarning(preservationWarning) {
        set({ preservationWarning })
      },

      updateDraft(draftSource) {
        if (get().document) {
          set({
            draftSource,
            errorMessage: get().status === 'error' ? null : get().errorMessage,
            status: get().status === 'error' ? 'ready' : get().status,
          })
        }
      },
    }
  })
}

export const useDocumentStore = createDocumentStore(documentService)
