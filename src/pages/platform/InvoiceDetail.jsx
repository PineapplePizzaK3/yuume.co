/**
 * Detalhe da fatura (snapshot JSON).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { PageSeo } from '../../components/PageSeo'
import { getInvoice, downloadInvoicePdf } from '../../services/invoiceService'

function moneyUsd(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function moneyBrl(n, locale) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR', { style: 'currency', currency: 'BRL' })
}

function moneyJpy(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })
}

export default function InvoiceDetail() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const lp = useLocalizedPath()
  const { id } = useParams()
  const { session } = useAuth()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !session?.access_token) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error: err } = await getInvoice(session.access_token, id)
      if (!active) return
      if (err) setError(err)
      else setRow(data)
      setLoading(false)
    }
    run()
    return () => {
      active = false
    }
  }, [id, session?.access_token])

  const d = row?.data_json || {}
  const ps = d.pricing_summary || {}
  const items = Array.isArray(d.items) ? d.items : []

  const handlePdf = async () => {
    if (!session?.access_token || !id) return
    setPdfBusy(true)
    setError('')
    try {
      await downloadInvoicePdf(session.access_token, id, `${d.invoice_number || 'invoice'}.pdf`)
    } catch (e) {
      setError(e?.message || t('platform.invoices.pdfError'))
    } finally {
      setPdfBusy(false)
    }
  }

  const issueDateStr = d.issue_date
    ? new Date(d.issue_date).toLocaleString(dateLocale)
    : '—'

  if (loading) {
    return (
      <div className="py-10 text-earth-600">
        <PageSeo
          routeKey="appInvoice"
          title={t('platform.invoiceDetail.metaTitle')}
          description={t('meta.appInvoice.description')}
          noindex
        />
        {t('platform.invoiceDetail.loading')}
      </div>
    )
  }

  if (error && !row) {
    return (
      <div className="py-10">
        <PageSeo
          routeKey="appInvoice"
          title={t('platform.invoiceDetail.metaTitle')}
          description={t('meta.appInvoice.description')}
          noindex
        />
        <p className="text-red-700">{error}</p>
        <Link to={lp('appInvoices')} className="mt-4 inline-block text-amber-800 underline">
          {t('platform.invoiceDetail.backInvoices')}
        </Link>
      </div>
    )
  }

  const titleHelmet = d.invoice_number
    ? t('platform.invoiceDetail.metaTitleWithNumber', { number: d.invoice_number })
    : t('platform.invoiceDetail.metaTitle')

  return (
    <div className="py-6">
      <PageSeo
        routeKey="appInvoice"
        title={titleHelmet}
        description={t('meta.appInvoice.description')}
        noindex
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={lp('appInvoices')} className="text-sm font-medium text-amber-800 hover:underline">
            {t('platform.invoiceDetail.backLink')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-earth-900">{d.invoice_number}</h1>
          <p className="text-sm text-earth-600">
            {t('platform.invoiceDetail.issuedLine', {
              id: d.order_id?.slice(0, 8),
              date: issueDateStr,
            })}
          </p>
        </div>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={handlePdf}
          className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-50"
        >
          {pdfBusy ? t('platform.invoiceDetail.generatingPdf') : t('platform.invoiceDetail.downloadPdf')}
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="space-y-6 rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
            {t('platform.invoiceDetail.sectionCustomer')}
          </h2>
          <p className="mt-2 text-earth-900">{d.customer?.name}</p>
          <p className="text-earth-700">{d.customer?.email}</p>
          <p className="text-sm text-earth-600">{d.customer?.country}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
            {t('platform.invoiceDetail.sectionItems')}
          </h2>
          <ul className="mt-3 divide-y divide-earth-100">
            {items.map((it, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-earth-900">
                  {it.item_name} × {it.quantity}
                </span>
                <span className="text-earth-700">
                  {moneyUsd(it.unit_price_usd)} · {moneyJpy(it.unit_price_jpy)} ·{' '}
                  {moneyBrl(it.unit_price_brl, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg bg-earth-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
            {t('platform.invoiceDetail.sectionTotals')}
          </h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-earth-600">{t('platform.invoiceDetail.subtotalUsd')}</dt>
              <dd className="font-medium">{moneyUsd(ps.subtotal_usd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-earth-600">{t('platform.invoiceDetail.subtotalBrl')}</dt>
              <dd>{moneyBrl(ps.subtotal_brl, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-earth-600">{t('platform.invoiceDetail.serviceFeeUsd')}</dt>
              <dd>{moneyUsd(ps.service_fee_usd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-earth-600">{t('platform.invoiceDetail.shippingUsd')}</dt>
              <dd>{moneyUsd(ps.shipping_usd)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-earth-200 pt-2 text-base">
              <dt className="font-semibold text-earth-900">{t('platform.invoiceDetail.totalPaidUsd')}</dt>
              <dd className="font-bold text-earth-900">{moneyUsd(ps.total_paid_usd)}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-earth-600">{t('platform.invoiceDetail.totalDisplayBrl')}</dt>
              <dd className="font-medium">{moneyBrl(ps.total_display_brl, locale)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
            {t('platform.invoiceDetail.sectionFx')}
          </h2>
          <p className="mt-2 text-sm text-earth-700">
            {t('platform.invoiceDetail.fxLine', {
              usdBrl: d.currency_info?.exchange_rate_usd_brl,
              jpyUsd: d.currency_info?.exchange_rate_jpy_usd,
            })}
          </p>
          <p className="mt-1 text-xs text-earth-500">{d.currency_info?.note}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-500">
            {t('platform.invoiceDetail.sectionPayment')}
          </h2>
          <p className="mt-2 text-sm text-earth-800">
            <strong>{d.payment?.payment_method}</strong> · {t('platform.invoiceDetail.payRef')}{' '}
            {d.payment?.transaction_id}
          </p>
          <p className="text-xs text-earth-500">
            {t('platform.invoiceDetail.invoiceCurrencyNote', { currency: d.payment?.currency })}
          </p>
        </section>

        <footer className="border-t border-earth-200 pt-4 text-xs text-earth-500">
          <p className="font-medium text-earth-700">{d.footer?.company_name}</p>
          <p>{d.footer?.support_contact}</p>
          <p className="mt-2">{d.footer?.disclaimer}</p>
        </footer>
      </div>
    </div>
  )
}
