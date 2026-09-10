import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

import { Crepe } from '@milkdown/crepe'
import { useEffect, useRef } from 'react'

interface VisualMarkdownEditorProps {
  disabled?: boolean
  initialMarkdown: string
  onChange(markdown: string): void
  onReady(normalizedMarkdown: string): void
}

export function VisualMarkdownEditor({
  disabled = false,
  initialMarkdown,
  onChange,
  onReady,
}: VisualMarkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const disabledRef = useRef(disabled)
  const initialMarkdownRef = useRef(initialMarkdown)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onChangeRef.current = onChange
    onReadyRef.current = onReady
  }, [onChange, onReady])

  useEffect(() => {
    disabledRef.current = disabled
    if (crepeRef.current) {
      crepeRef.current.setReadonly(disabled)
    }
  }, [disabled])

  useEffect(() => {
    if (!rootRef.current) {
      return
    }

    let acceptingChanges = false
    let created = false
    let disposed = false
    const crepe = new Crepe({
      defaultValue: initialMarkdownRef.current,
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.ImageBlock]: false,
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.TopBar]: true,
      },
      root: rootRef.current,
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_context, markdown) => {
        if (acceptingChanges && !disposed) {
          onChangeRef.current(markdown)
        }
      })
    })

    void crepe.create().then(() => {
      created = true
      if (disposed) {
        void crepe.destroy()
        return
      }

      crepeRef.current = crepe
      crepe.setReadonly(disabledRef.current)
      onReadyRef.current(crepe.getMarkdown())
      acceptingChanges = true
    })

    return () => {
      disposed = true
      crepeRef.current = null
      if (created) {
        void crepe.destroy()
      }
    }
  }, [])

  return (
    <div
      aria-label="시각적 Markdown 편집기"
      className="milkdown-shell min-h-[34rem]"
      ref={rootRef}
    />
  )
}
