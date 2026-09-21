import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

import { Crepe } from '@milkdown/crepe'
import { type MouseEvent, useEffect, useRef } from 'react'

interface VisualMarkdownEditorProps {
  disabled?: boolean
  initialMarkdown: string
  onChange(markdown: string): void
  onReady(normalizedMarkdown: string): void
  onUploadImage(file: File): Promise<string>
  resolveAttachmentFile(url: string): Promise<File | null>
}

export function VisualMarkdownEditor({
  disabled = false,
  initialMarkdown,
  onChange,
  onReady,
  onUploadImage,
  resolveAttachmentFile,
}: VisualMarkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const disabledRef = useRef(disabled)
  const initialMarkdownRef = useRef(initialMarkdown)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const onUploadImageRef = useRef(onUploadImage)
  const resolveAttachmentFileRef = useRef(resolveAttachmentFile)

  useEffect(() => {
    onChangeRef.current = onChange
    onReadyRef.current = onReady
    onUploadImageRef.current = onUploadImage
    resolveAttachmentFileRef.current = resolveAttachmentFile
  }, [onChange, onReady, onUploadImage, resolveAttachmentFile])

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
    const objectUrls = new Set<string>()
    const crepe = new Crepe({
      defaultValue: initialMarkdownRef.current,
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          blockCaptionPlaceholderText: '이미지 설명',
          blockConfirmButton: '확인',
          blockUploadButton: '이미지 선택',
          blockUploadPlaceholderText: '또는 이미지 링크 붙여넣기',
          inlineConfirmButton: '확인',
          inlineUploadButton: '이미지 선택',
          inlineUploadPlaceholderText: '또는 이미지 링크 붙여넣기',
          onUpload: (file) => onUploadImageRef.current(file),
          proxyDomURL: async (url) => {
            const file = await resolveAttachmentFileRef.current(url)
            if (!file || disposed) {
              return url
            }

            const objectUrl = URL.createObjectURL(file)
            objectUrls.add(objectUrl)
            return objectUrl
          },
        },
      },
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.ImageBlock]: true,
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
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
    }
  }, [])

  const handleAttachmentClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    const anchor =
      target instanceof Element ? target.closest<HTMLAnchorElement>('a') : null
    const href = anchor?.getAttribute('href')
    if (
      !anchor ||
      !href ||
      !/(^|\/)Attachments\//.test(href) ||
      /^[a-z][a-z\d+.-]*:/i.test(href)
    ) {
      return
    }

    event.preventDefault()
    void resolveAttachmentFileRef.current(href).then((file) => {
      if (!file) {
        return
      }

      const objectUrl = URL.createObjectURL(file)
      const download = document.createElement('a')
      download.href = objectUrl
      download.download = anchor.textContent?.trim() || file.name
      download.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    })
  }

  return (
    <div
      aria-label="시각적 Markdown 편집기"
      className="milkdown-shell min-h-[34rem]"
      onClick={handleAttachmentClick}
      ref={rootRef}
    />
  )
}
