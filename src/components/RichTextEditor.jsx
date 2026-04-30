import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { sanitizeRichTextHtml } from '../lib/richText'

/** Cor padrão do texto (earth-900) — “redefinir cor” volta para isso. */
const DEFAULT_TEXT_COLOR = '#1c1917'

const TEXT_SWATCHES = ['#1c1917', '#b91c1c', '#065f46', '#1d4ed8', '#7c3aed', '#c2410c']

const HIGHLIGHT_SWATCHES = ['#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#f3f4f6']

/** Evita que o botão roube o foco e destrua a seleção no contentEditable. */
function preventToolbarMouseDown(e) {
  e.preventDefault()
}

function createEmptyMarks() {
  return {
    bold: false,
    italic: false,
    underline: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    listBullet: false,
    listOrdered: false,
  }
}

function IconBold({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zm0 8h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" />
    </svg>
  )
}

function IconItalic({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4M8 20h4M12 4l-4 16" />
    </svg>
  )
}

function IconUnderline({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" d="M6 19h12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v7a4 4 0 008 0V4" />
    </svg>
  )
}

function IconUndo({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />
    </svg>
  )
}

function IconRedo({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 100 11H13" />
    </svg>
  )
}

function IconLink({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.415-1.414M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.415 1.414" />
    </svg>
  )
}

function IconUnlink({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h2a4 4 0 014 4M18 14v2M6 18H4a4 4 0 01-4-4v-2m8-6V4m8 12l-4-4M4 4l16 16" />
    </svg>
  )
}

function IconAlignLeft({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  )
}

function IconAlignCenter({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  )
}

function IconAlignRight({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M10 12h10M6 18h14" />
    </svg>
  )
}

function IconListBullet({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M9 6h12M9 12h12M9 18h12M5 6h.01M5 12h.01M5 18h.01" />
    </svg>
  )
}

function IconListNumbered({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M10 6h10M10 12h10M10 18h10M4 6h1M4 12h2M4 18h2" />
    </svg>
  )
}

function IconClearFormat({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M9 9l6-6m-6 6l6 6M4 20h4" />
    </svg>
  )
}

function IconPalette({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2v-2a2 2 0 00-2-2h-2M6 20V10a2 2 0 012-2h2a2 2 0 012 2v10" />
    </svg>
  )
}

function IconHighlight({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4l5 5-8 8H7v-5l8-8z" />
    </svg>
  )
}

function IconReset({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0114.138-6M19 5a9 9 0 01-14.138 6" />
    </svg>
  )
}

function ToolbarIconButton({ onClick, title, toggle = false, pressed = false, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={toggle ? pressed : undefined}
      onMouseDown={preventToolbarMouseDown}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-earth-800 transition ${
        toggle && pressed
          ? 'border-earth-600 bg-earth-100'
          : 'border-earth-200 bg-white hover:border-earth-400 hover:bg-earth-50'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-earth-200 sm:block" aria-hidden />
}

function askForUrl() {
  const input = window.prompt('Digite a URL do link (https://...)')
  if (!input) return ''
  const value = input.trim()
  if (!value) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value
  return `https://${value}`
}

export default function RichTextEditor({
  value = '',
  onChange = () => {},
  placeholder = '',
  className = '',
  /** Altura mínima da área editável (px). */
  editorMinHeightPx = 110,
  /** Altura máxima antes de rolar por dentro (px). */
  editorMaxHeightPx = 320,
}) {
  const editorRef = useRef(null)
  const textColorInputRef = useRef(null)
  const highlightInputRef = useRef(null)
  const toolbarSyncRaf = useRef(0)
  const normalized = useMemo(() => sanitizeRichTextHtml(value), [value])
  const [activeBlock, setActiveBlock] = useState('')
  const [marks, setMarks] = useState(createEmptyMarks)

  const adjustEditorHeight = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const minH = Math.max(48, Number(editorMinHeightPx) || 110)
    const maxH = Math.max(minH, Number(editorMaxHeightPx) || 320)
    el.style.height = 'auto'
    const scrollH = el.scrollHeight
    const next = Math.min(Math.max(scrollH, minH), maxH)
    el.style.height = `${next}px`
    el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
    el.style.overflowX = 'hidden'
  }, [editorMinHeightPx, editorMaxHeightPx])

  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    /* Comparar via sanitize nos dois lados: o browser serializa innerHTML de
       forma diferente do nosso parser (espaços em style, b vs strong, etc.).
       Igualdade “semântica” evita regravar innerHTML a cada render — isso
       destruía seleção e fazia negrito/alinhamento “voltarem” sozinhos. */
    const domSanitized = sanitizeRichTextHtml(el.innerHTML)
    if (domSanitized !== normalized) {
      el.innerHTML = normalized || ''
    }
    adjustEditorHeight()
  }, [normalized, adjustEditorHeight])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    onChange(sanitizeRichTextHtml(el.innerHTML))
    requestAnimationFrame(() => adjustEditorHeight())
  }, [onChange, adjustEditorHeight])

  const readFormatBlock = useCallback(() => {
    try {
      const raw = String(document.queryCommandValue('formatBlock') || '')
        .toLowerCase()
        .replace(/[<>]/g, '')
      if (raw.includes('h4')) return 'h4'
      if (raw.includes('h3')) return 'h3'
      if (raw.includes('h2')) return 'h2'
      if (raw.includes('h1')) return ''
      return 'p'
    } catch {
      return 'p'
    }
  }, [])

  const readInlineMarks = useCallback(() => {
    try {
      let alignLeft = document.queryCommandState('justifyLeft')
      let alignCenter = document.queryCommandState('justifyCenter')
      let alignRight = document.queryCommandState('justifyRight')
      if (!alignLeft && !alignCenter && !alignRight) {
        const j = String(document.queryCommandValue('justify') || '').toLowerCase()
        if (j === 'center') alignCenter = true
        else if (j === 'right') alignRight = true
        else if (j === 'left' || j === 'start') alignLeft = true
      }
      return {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        alignLeft,
        alignCenter,
        alignRight,
        listBullet: document.queryCommandState('insertUnorderedList'),
        listOrdered: document.queryCommandState('insertOrderedList'),
      }
    } catch {
      return createEmptyMarks()
    }
  }, [])

  const syncToolbarFromSelection = useCallback(() => {
    cancelAnimationFrame(toolbarSyncRaf.current)
    toolbarSyncRaf.current = requestAnimationFrame(() => {
      const root = editorRef.current
      if (!root) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) {
        setMarks(createEmptyMarks())
        return
      }
      let node = sel.anchorNode
      if (!node) return
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      if (!node || !root.contains(node)) {
        setMarks(createEmptyMarks())
        return
      }
      setActiveBlock(readFormatBlock())
      setMarks(readInlineMarks())
    })
  }, [readFormatBlock, readInlineMarks])

  useEffect(() => {
    document.addEventListener('selectionchange', syncToolbarFromSelection)
    return () => {
      cancelAnimationFrame(toolbarSyncRaf.current)
      document.removeEventListener('selectionchange', syncToolbarFromSelection)
    }
  }, [syncToolbarFromSelection])

  const runCommand = useCallback(
    (command, commandValue = undefined) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand(command, false, commandValue)
      emitChange()
      setActiveBlock(readFormatBlock())
      setMarks(readInlineMarks())
    },
    [emitChange, readFormatBlock, readInlineMarks]
  )

  const applyFormatBlock = useCallback(
    (tag) => {
      const map = {
        p: '<p>',
        h2: '<h2>',
        h3: '<h3>',
        h4: '<h4>',
      }
      const block = map[tag]
      if (!block) return
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand('formatBlock', false, block)
      emitChange()
      setActiveBlock(tag)
      setMarks(readInlineMarks())
    },
    [emitChange, readInlineMarks]
  )

  const applyTextColor = useCallback(
    (hex) => {
      if (!hex) return
      runCommand('foreColor', hex)
      if (textColorInputRef.current) textColorInputRef.current.value = hex
    },
    [runCommand]
  )

  const resetTextColor = useCallback(() => {
    applyTextColor(DEFAULT_TEXT_COLOR)
  }, [applyTextColor])

  const applyHighlightColor = useCallback(
    (color) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch {
        /* ignore */
      }
      document.execCommand('hiliteColor', false, color) || document.execCommand('backColor', false, color)
      emitChange()
      setMarks(readInlineMarks())
      if (highlightInputRef.current && color !== 'transparent') {
        highlightInputRef.current.value = /^#[0-9a-f]{6}$/i.test(color) ? color : highlightInputRef.current.value
      }
    },
    [emitChange, readInlineMarks]
  )

  const clearHighlight = useCallback(() => {
    applyHighlightColor('transparent')
  }, [applyHighlightColor])

  const openTextColorPicker = useCallback(() => {
    const input = textColorInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.click()
    }
  }, [])

  const openHighlightPicker = useCallback(() => {
    const input = highlightInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.click()
    }
  }, [])

  const handleInsertLink = useCallback(() => {
    const url = askForUrl()
    if (!url) return
    runCommand('createLink', url)
  }, [runCommand])

  return (
    <div className={`mt-1 overflow-hidden rounded-lg border border-earth-300 bg-white shadow-sm ${className}`}>
      <div className="border-b border-earth-200 bg-earth-50/80 px-2 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarIconButton title="Desfazer (Ctrl+Z)" onClick={() => runCommand('undo')}>
            <IconUndo />
          </ToolbarIconButton>
          <ToolbarIconButton title="Refazer (Ctrl+Shift+Z / Ctrl+Y)" onClick={() => runCommand('redo')}>
            <IconRedo />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton title="Negrito" toggle pressed={marks.bold} onClick={() => runCommand('bold')}>
            <IconBold />
          </ToolbarIconButton>
          <ToolbarIconButton title="Itálico" toggle pressed={marks.italic} onClick={() => runCommand('italic')}>
            <IconItalic />
          </ToolbarIconButton>
          <ToolbarIconButton title="Sublinhado" toggle pressed={marks.underline} onClick={() => runCommand('underline')}>
            <IconUnderline />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton title="Inserir link" onClick={handleInsertLink}>
            <IconLink />
          </ToolbarIconButton>
          <ToolbarIconButton title="Remover link" onClick={() => runCommand('unlink')}>
            <IconUnlink />
          </ToolbarIconButton>
          <ToolbarIconButton title="Limpar formatação da seleção" onClick={() => runCommand('removeFormat')}>
            <IconClearFormat />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton title="Alinhar à esquerda" toggle pressed={marks.alignLeft} onClick={() => runCommand('justifyLeft')}>
            <IconAlignLeft />
          </ToolbarIconButton>
          <ToolbarIconButton title="Centralizar" toggle pressed={marks.alignCenter} onClick={() => runCommand('justifyCenter')}>
            <IconAlignCenter />
          </ToolbarIconButton>
          <ToolbarIconButton title="Alinhar à direita" toggle pressed={marks.alignRight} onClick={() => runCommand('justifyRight')}>
            <IconAlignRight />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton title="Lista com marcadores" toggle pressed={marks.listBullet} onClick={() => runCommand('insertUnorderedList')}>
            <IconListBullet />
          </ToolbarIconButton>
          <ToolbarIconButton title="Lista numerada" toggle pressed={marks.listOrdered} onClick={() => runCommand('insertOrderedList')}>
            <IconListNumbered />
          </ToolbarIconButton>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-earth-200/80 pt-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-earth-500">Bloco</span>
          {[
            { tag: 'p', label: 'P' },
            { tag: 'h2', label: 'H2' },
            { tag: 'h3', label: 'H3' },
            { tag: 'h4', label: 'H4' },
          ].map(({ tag, label }) => (
            <button
              key={tag}
              type="button"
              title={tag === 'p' ? 'Parágrafo' : `Título ${tag.toUpperCase()}`}
              onMouseDown={preventToolbarMouseDown}
              onClick={() => applyFormatBlock(tag)}
              className={`h-8 min-w-[2rem] rounded-md border px-2 text-xs font-semibold ${
                activeBlock === tag ? 'border-earth-700 bg-earth-200 text-earth-900' : 'border-earth-200 bg-white text-earth-700 hover:bg-earth-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-earth-200/80 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-earth-500">Cor do texto</span>
          <ToolbarIconButton title="Abrir seletor de cor" onClick={openTextColorPicker}>
            <IconPalette />
          </ToolbarIconButton>
          <input
            type="color"
            ref={textColorInputRef}
            defaultValue={DEFAULT_TEXT_COLOR}
            className="h-9 w-11 cursor-pointer rounded-md border border-earth-300 bg-white p-0.5 shadow-sm"
            title="Escolher qualquer cor"
            onMouseDown={preventToolbarMouseDown}
            onChange={(e) => applyTextColor(e.target.value)}
          />
          <ToolbarIconButton title="Cor padrão do site" onClick={resetTextColor}>
            <IconReset />
          </ToolbarIconButton>
          <div className="flex flex-wrap items-center gap-1 pl-1">
            {TEXT_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onMouseDown={preventToolbarMouseDown}
                onClick={() => applyTextColor(hex)}
                className="h-6 w-6 shrink-0 rounded-full border border-earth-300 ring-1 ring-black/5 hover:scale-110 hover:ring-2 hover:ring-earth-400"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-earth-200/80 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-earth-500">Destaque</span>
          <ToolbarIconButton title="Abrir cor de fundo / marca-texto" onClick={openHighlightPicker}>
            <IconHighlight />
          </ToolbarIconButton>
          <input
            ref={highlightInputRef}
            type="color"
            defaultValue="#fef9c3"
            className="h-8 w-10 cursor-pointer rounded border border-earth-300 bg-white p-0.5"
            title="Cor de fundo (marca-texto)"
            onMouseDown={preventToolbarMouseDown}
            onChange={(e) => applyHighlightColor(e.target.value)}
          />
          <ToolbarIconButton title="Remover marca-texto" onClick={clearHighlight}>
            <span className="text-xs font-bold leading-none">∅</span>
          </ToolbarIconButton>
          <div className="flex flex-wrap items-center gap-1 pl-1">
            {HIGHLIGHT_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onMouseDown={preventToolbarMouseDown}
                onClick={() => applyHighlightColor(hex)}
                className="h-6 w-6 shrink-0 rounded-full border border-earth-300 hover:scale-110 hover:ring-2 hover:ring-earth-400"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onFocus={syncToolbarFromSelection}
        onKeyUp={syncToolbarFromSelection}
        onMouseUp={syncToolbarFromSelection}
        onKeyDown={(e) => {
          const mod = e.ctrlKey || e.metaKey
          if (!mod) return
          const k = e.key.toLowerCase()
          if (k === 'z' || k === 'y') {
            window.requestAnimationFrame(() => emitChange())
          }
        }}
        className="rich-text-editor prose prose-sm max-w-none min-h-0 resize-none px-3 py-2 text-sm text-earth-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-earth-400/60 empty:before:pointer-events-none empty:before:text-earth-400 empty:before:content-[attr(data-placeholder)] [&_b]:font-bold [&_strong]:font-bold"
      />
    </div>
  )
}
