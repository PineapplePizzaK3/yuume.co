import { useEffect, useMemo, useRef } from 'react'
import { sanitizeRichTextHtml } from '../lib/richText'

const COLOR_PRESETS = ['#111827', '#b91c1c', '#065f46', '#1d4ed8', '#7c3aed', '#c2410c']

/** Cores de fundo / destaque (inline); `transparent` remove o realce na maioria dos navegadores. */
const HIGHLIGHT_PRESETS = [
  { label: 'Sem fundo', value: 'transparent' },
  { label: 'Amarelo', value: '#fef9c3' },
  { label: 'Verde', value: '#dcfce7' },
  { label: 'Azul', value: '#dbeafe' },
  { label: 'Rosa', value: '#fce7f3' },
  { label: 'Cinza', value: '#f3f4f6' },
]

function ToolbarButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded border border-earth-300 bg-white px-2 py-1 text-xs font-medium text-earth-700 hover:bg-earth-50"
    >
      {children}
    </button>
  )
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
  minHeightClassName = 'min-h-[96px]',
}) {
  const editorRef = useRef(null)
  const normalized = useMemo(() => sanitizeRichTextHtml(value), [value])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (el.innerHTML !== normalized) {
      el.innerHTML = normalized || ''
    }
  }, [normalized])

  const emitChange = () => {
    const el = editorRef.current
    if (!el) return
    onChange(sanitizeRichTextHtml(el.innerHTML))
  }

  const runCommand = (command, commandValue = undefined) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, commandValue)
    emitChange()
  }

  const handleColorChange = (event) => {
    const color = event.target.value
    if (!color) return
    runCommand('foreColor', color)
  }

  const applyHighlightColor = (color) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    try {
      document.execCommand('styleWithCSS', false, 'true')
    } catch {
      /* alguns navegadores não expõem styleWithCSS */
    }
    document.execCommand('hiliteColor', false, color) ||
      document.execCommand('backColor', false, color)
    emitChange()
  }

  const handleHighlightChange = (event) => {
    const color = event.target.value
    if (!color) return
    applyHighlightColor(color)
  }

  const handleInsertLink = () => {
    const url = askForUrl()
    if (!url) return
    runCommand('createLink', url)
  }

  return (
    <div className={`mt-1 rounded-lg border border-earth-300 bg-white ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-earth-200 p-2">
        <ToolbarButton title="Desfazer (Ctrl+Z)" onClick={() => runCommand('undo')}>
          Desfazer
        </ToolbarButton>
        <ToolbarButton title="Refazer (Ctrl+Y ou Ctrl+Shift+Z)" onClick={() => runCommand('redo')}>
          Refazer
        </ToolbarButton>
        <span className="mx-0.5 hidden h-5 w-px bg-earth-200 sm:inline-block" aria-hidden />
        <ToolbarButton title="Negrito" onClick={() => runCommand('bold')}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => runCommand('italic')}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton title="Sublinhado" onClick={() => runCommand('underline')}>
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton title="Limpar formatação" onClick={() => runCommand('removeFormat')}>
          Limpar
        </ToolbarButton>
        <ToolbarButton title="Inserir link" onClick={handleInsertLink}>
          Link
        </ToolbarButton>
        <ToolbarButton title="Remover link" onClick={() => runCommand('unlink')}>
          Unlink
        </ToolbarButton>
        <ToolbarButton title="Alinhar à esquerda" onClick={() => runCommand('justifyLeft')}>
          Esq
        </ToolbarButton>
        <ToolbarButton title="Centralizar" onClick={() => runCommand('justifyCenter')}>
          Centro
        </ToolbarButton>
        <ToolbarButton title="Alinhar à direita" onClick={() => runCommand('justifyRight')}>
          Dir
        </ToolbarButton>
        <ToolbarButton title="Lista com marcadores" onClick={() => runCommand('insertUnorderedList')}>
          • Lista
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => runCommand('insertOrderedList')}>
          1. Lista
        </ToolbarButton>
        <label className="ml-1 inline-flex items-center gap-1 text-xs text-earth-700">
          Estilo
          <select
            defaultValue=""
            onChange={(event) => {
              const block = event.target.value
              if (!block) return
              runCommand('formatBlock', block)
              event.target.value = ''
            }}
            className="rounded border border-earth-300 px-1.5 py-1 text-xs text-earth-800"
          >
            <option value="" disabled>Escolher</option>
            <option value="p">Parágrafo</option>
            <option value="h2">Título grande</option>
            <option value="h3">Título médio</option>
            <option value="h4">Título pequeno</option>
          </select>
        </label>
        <label className="ml-1 inline-flex items-center gap-1 text-xs text-earth-700">
          Cor
          <select
            defaultValue=""
            onChange={handleColorChange}
            className="rounded border border-earth-300 px-1.5 py-1 text-xs text-earth-800"
          >
            <option value="" disabled>Escolher</option>
            {COLOR_PRESETS.map((hex) => (
              <option key={hex} value={hex}>
                {hex}
              </option>
            ))}
          </select>
        </label>
        <label className="ml-1 inline-flex items-center gap-1 text-xs text-earth-700">
          Fundo
          <select
            defaultValue=""
            onChange={handleHighlightChange}
            className="rounded border border-earth-300 px-1.5 py-1 text-xs text-earth-800"
          >
            <option value="" disabled>Escolher</option>
            {HIGHLIGHT_PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyDown={(e) => {
          const mod = e.ctrlKey || e.metaKey
          if (!mod) return
          const k = e.key.toLowerCase()
          if (k === 'z' || k === 'y') {
            window.requestAnimationFrame(() => emitChange())
          }
        }}
        className={`rich-text-editor prose prose-sm max-w-none px-3 py-2 text-sm text-earth-900 focus:outline-none ${minHeightClassName}`}
      />
    </div>
  )
}
