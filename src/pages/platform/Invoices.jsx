/**
 * Lista de faturas (pedidos com status paid).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { PageSeo } from '../../components/PageSeo'
import { listInvoices, downloadInvoicePdf } from '../../services/invoiceService'

function formatUsd(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatBrl(n, locale) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso, dateLocale) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(dateLocale)
  } catch {
    return iso
  }
}

export default function Invoices() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const lp = useLocalizedPath()
  const { session } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      if (!session?.access_token) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await listInvoices(session.access_token)
      if (!active) return
      if (error) setFeedback(error)
      else setRows(data || [])
      setLoading(false)
    }
    run()
    return () => {
      active = false
    }
  }, [session?.access_token])

  const handlePdf = async (id, invoiceNumber) => {
    if (!session?.access_token) return
    setDownloadingId(id)
    setFeedback('')
    try {
      await downloadInvoicePdf(session.access_token, id, `${invoiceNumber || 'invoice'}.pdf`)
    } catch (e) {
      setFeedback(e?.message || t('platform.invoices.pdfError'))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="py-6">
      <PageSeo
        routeKey="appInvoice"
        title={t('meta.appInvoice.title')}
        description={t('meta.appInvoice.description')}
        noindex
      />
      <h1 className="text-2xl font-bold text-earth-900">{t('platform.invoices.pageTitle')}</h1>
      <p className="mt-2 text-earth-600 max-w-2xl">
        {t('platform.invoices.intro')}
      </p>

      {feedback && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{feedback}</p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-earth-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-earth-600">{t('platform.invoices.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-earth-600">{t('platform.invoices.empty')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-earth-200 bg-earth-50 text-left text-earth-700">
                <th className="px-4 py-3 font-medium">{t('platform.invoices.colNumber')}</th>
                <th className="px-4 py-3 font-medium">{t('platform.invoices.colDate')}</th>
                <th className="px-4 py-3 font-medium">{t('platform.invoices.colUsd')}</th>
                <th className="px-4 py-3 font-medium">{t('platform.invoices.colBrl')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('platform.invoices.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-earth-100 hover:bg-earth-50/80">
                  <td className="px-4 py-3 font-medium text-earth-900">{r.invoice_number}</td>
                  <td className="px-4 py-3 text-earth-700">{formatDate(r.created_at, dateLocale)}</td>
                  <td className="px-4 py-3 text-earth-800">{formatUsd(r.total_paid_usd)}</td>
                  <td className="px-4 py-3 text-earth-800">{formatBrl(r.total_display_brl, locale)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={lp('appInvoices', `/${r.id}`)}
                      className="mr-3 font-medium text-amber-800 underline hover:text-amber-900"
                    >
                      {t('platform.invoices.view')}
                    </Link>
                    <button
                      type="button"
                      disabled={downloadingId === r.id}
                      onClick={() => handlePdf(r.id, r.invoice_number)}
                      className="font-medium text-earth-800 underline hover:text-earth-900 disabled:opacity-50"
                    >
                      {downloadingId === r.id ? t('platform.invoices.generating') : t('platform.invoices.pdf')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
