/**
 * Exibe texto com URLs http(s) detectadas como links clicáveis.
 */
export function linkifyStringToNodes(text) {
  const t = text == null ? '' : String(text)
  if (!t) return []
  const re = /(https?:\/\/[^\s]+)/gi
  const nodes = []
  let last = 0
  let m
  re.lastIndex = 0
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) {
      nodes.push(t.slice(last, m.index))
    }
    let href = m[1]
    while (/[.,;:!?)]+$/.test(href)) {
      href = href.slice(0, -1)
    }
    nodes.push(
      <a
        key={`${m.index}-${href.slice(0, 24)}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-medium text-earth-900 underline decoration-earth-400 underline-offset-2 hover:text-earth-700"
      >
        {href}
      </a>
    )
    last = m.index + m[0].length
  }
  if (last < t.length) {
    nodes.push(t.slice(last))
  }
  return nodes
}

export default function LinkifyText({ text, className = '', as: Tag = 'span' }) {
  const nodes = linkifyStringToNodes(text)
  if (nodes.length === 0) return null
  return <Tag className={className}>{nodes}</Tag>
}
