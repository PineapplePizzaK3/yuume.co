import { useMemo } from 'react'
import { sanitizeRichTextHtml } from '../lib/richText'

export default function RichTextContent({ html = '', className = '' }) {
  const safeHtml = useMemo(() => sanitizeRichTextHtml(html), [html])
  if (!safeHtml) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />
}
