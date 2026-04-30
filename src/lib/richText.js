const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'BR',
  'P',
  'DIV',
  'SPAN',
  'UL',
  'OL',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
])

const ALLOWED_CSS_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
])

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeInlineStyle(styleValue) {
  const raw = String(styleValue || '').trim()
  if (!raw) return ''
  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(':')
      if (separator < 1) return ''
      const prop = entry.slice(0, separator).trim().toLowerCase()
      const value = entry.slice(separator + 1).trim()
      if (!ALLOWED_CSS_PROPERTIES.has(prop)) return ''
      if (!value) return ''
      if (/url\s*\(|expression\s*\(/i.test(value)) return ''
      return `${prop}: ${value}`
    })
    .filter(Boolean)
    .join('; ')
}

function sanitizeHref(rawHref) {
  const href = String(rawHref || '').trim()
  if (!href) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href
  return ''
}

function sanitizeNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const tag = node.tagName.toUpperCase()
  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = doc.createDocumentFragment()
    node.childNodes.forEach((child) => {
      const safeChild = sanitizeNode(child, doc)
      if (safeChild) fragment.appendChild(safeChild)
    })
    return fragment
  }

  const safeEl = doc.createElement(tag.toLowerCase())

  if (tag === 'A') {
    const safeHref = sanitizeHref(node.getAttribute('href'))
    if (safeHref) {
      safeEl.setAttribute('href', safeHref)
      safeEl.setAttribute('target', '_blank')
      safeEl.setAttribute('rel', 'noopener noreferrer')
    }
  }

  const safeStyle = sanitizeInlineStyle(node.getAttribute('style'))
  if (safeStyle) safeEl.setAttribute('style', safeStyle)

  node.childNodes.forEach((child) => {
    const safeChild = sanitizeNode(child, doc)
    if (safeChild) safeEl.appendChild(safeChild)
  })

  return safeEl
}

export function sanitizeRichTextHtml(rawHtml) {
  const raw = String(rawHtml || '').trim()
  if (!raw) return ''
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(raw)
  if (!hasHtmlTags) {
    return escapeHtml(raw).replace(/\r?\n/g, '<br>')
  }
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return escapeHtml(raw)

  const parser = new DOMParser()
  const parsed = parser.parseFromString(raw, 'text/html')
  const cleanDoc = document.implementation.createHTMLDocument('')
  const wrapper = cleanDoc.createElement('div')
  parsed.body.childNodes.forEach((node) => {
    const safeNode = sanitizeNode(node, cleanDoc)
    if (safeNode) wrapper.appendChild(safeNode)
  })
  return wrapper.innerHTML.trim()
}

export function richTextToPlainText(value) {
  const raw = String(value || '')
  if (!raw.trim()) return ''
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const parser = new DOMParser()
  const parsed = parser.parseFromString(raw, 'text/html')
  const txt = parsed.body.textContent || ''
  return txt.replace(/\s+/g, ' ').trim()
}
