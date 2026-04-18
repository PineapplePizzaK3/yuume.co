import { Trans, useTranslation } from 'react-i18next'

/** Links oficiais Japan Post (internacional). */
const JP_LINKS = {
  ems: 'https://www.post.japanpost.jp/int/ems/index_en.html',
  parcel: 'https://www.post.japanpost.jp/int/service/index_en.html',
  smallPacket: 'https://www.post.japanpost.jp/int/service/small_packet/index_en.html',
}

function DetailLink({ href }) {
  const { t } = useTranslation()
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-red-700 underline decoration-red-700/80 underline-offset-2 hover:text-red-800"
    >
      <span className="select-none" aria-hidden>
        &gt;{' '}
      </span>
      {t('publicSimulador.shippingGuideDetailLink')}
    </a>
  )
}

/** Ícone EMS (avião + globo), estilo Japan Post. */
function EmsServiceIcon({ className }) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded border border-sky-600 bg-sky-500 ${className ?? ''}`}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="h-9 w-9 text-amber-100">
        <circle cx="24" cy="26" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          fill="currentColor"
          d="M8 22 L38 18 L34 24 L38 30 L8 26 Z"
          transform="rotate(-8 24 24)"
        />
      </svg>
    </div>
  )
}

/** Caixa isométrica com medidas A (comprimento) e B (circunferência / largura). */
function BoxDiagramAB({ idSuffix }) {
  const uid = idSuffix ?? 'ab'
  return (
    <svg viewBox="0 0 140 100" className="h-auto w-full max-w-[200px]" aria-hidden>
      <defs>
        <linearGradient id={`boxTop-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8D5C4" />
          <stop offset="100%" stopColor="#D4B896" />
        </linearGradient>
        <linearGradient id={`boxFront-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D4B896" />
          <stop offset="100%" stopColor="#B8957A" />
        </linearGradient>
        <linearGradient id={`boxSide-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C4A882" />
          <stop offset="100%" stopColor="#9A7B6A" />
        </linearGradient>
      </defs>
      {/* topo */}
      <polygon
        points="70,8 128,28 70,48 12,28"
        fill={`url(#boxTop-${uid})`}
        stroke="#7A5C4A"
        strokeWidth="1"
      />
      {/* frente */}
      <polygon
        points="12,28 70,48 70,92 12,72"
        fill={`url(#boxFront-${uid})`}
        stroke="#7A5C4A"
        strokeWidth="1"
      />
      {/* lateral */}
      <polygon
        points="70,48 128,28 128,72 70,92"
        fill={`url(#boxSide-${uid})`}
        stroke="#7A5C4A"
        strokeWidth="1"
      />
      {/* A — aresta longa (topo) */}
      <circle cx="100" cy="22" r="10" fill="#B91C1C" />
      <text x="100" y="26" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
        A
      </text>
      {/* B — lateral */}
      <circle cx="118" cy="58" r="10" fill="#15803D" />
      <text x="118" y="62" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
        B
      </text>
    </svg>
  )
}

/** Pacote mais baixo com A, B, C (pacotes pequenos). */
function BoxDiagramFlatABC() {
  return (
    <svg viewBox="0 0 160 90" className="h-auto w-full max-w-[220px]" aria-hidden>
      <defs>
        <linearGradient id="flatTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8D5C4" />
          <stop offset="100%" stopColor="#D4B896" />
        </linearGradient>
        <linearGradient id="flatFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D4B896" />
          <stop offset="100%" stopColor="#B8957A" />
        </linearGradient>
        <linearGradient id="flatSide" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C4A882" />
          <stop offset="100%" stopColor="#9A7B6A" />
        </linearGradient>
      </defs>
      <polygon points="80,18 148,38 80,52 12,38" fill="url(#flatTop)" stroke="#7A5C4A" strokeWidth="1" />
      <polygon points="12,38 80,52 80,82 12,68" fill="url(#flatFront)" stroke="#7A5C4A" strokeWidth="1" />
      <polygon points="80,52 148,38 148,68 80,82" fill="url(#flatSide)" stroke="#7A5C4A" strokeWidth="1" />
      <circle cx="128" cy="30" r="9" fill="#B91C1C" />
      <text x="128" y="34" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
        A
      </text>
      <circle cx="138" cy="54" r="9" fill="#15803D" />
      <text x="138" y="58" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
        B
      </text>
      <circle cx="100" cy="72" r="9" fill="#1D4ED8" />
      <text x="100" y="76" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
        C
      </text>
    </svg>
  )
}

function BulletList({ keys }) {
  const { t } = useTranslation()
  return (
    <ul className="list-none space-y-2 pl-0 text-sm leading-relaxed text-earth-800">
      {keys.map((k) => (
        <li key={k} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-earth-800" aria-hidden />
          <span>{t(`publicSimulador.${k}`)}</span>
        </li>
      ))}
    </ul>
  )
}

function SectionHeader({ title, href }) {
  return (
    <div className="flex flex-col gap-2 border-b-2 border-red-700 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <h4 className="text-lg font-bold text-red-700">{title}</h4>
      <DetailLink href={href} />
    </div>
  )
}

/**
 * Infográfico “Confirme a forma do item” — EMS, encomendas internacionais, pacotes pequenos.
 * Baseado nas tabelas Japan Post para envio ao exterior.
 */
export function ShippingTypesGuide() {
  const { t } = useTranslation()

  return (
    <section
      className="rounded-lg border border-earth-200 bg-white p-4 shadow-sm sm:p-6"
      aria-labelledby="shipping-types-guide-title"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border-2 border-red-700 bg-white"
          aria-hidden
        >
          <span className="relative block h-6 w-8">
            <span className="absolute inset-0 rounded-sm border-2 border-red-700 bg-red-50" />
            <span className="absolute -right-1 -top-1 h-5 w-6 rounded-sm border-2 border-red-700 bg-red-100/80" />
          </span>
        </div>
        <div>
          <h3 id="shipping-types-guide-title" className="text-xl font-bold tracking-tight text-red-700 sm:text-2xl">
            {t('publicSimulador.shippingGuideTitle')}
          </h3>
          <p className="mt-2 text-sm text-earth-700">{t('publicSimulador.shippingGuideIntro')}</p>
        </div>
      </div>

      <div className="space-y-10">
        {/* EMS */}
        <div>
          <SectionHeader title={t('publicSimulador.shippingGuideEmsTitle')} href={JP_LINKS.ems} />
          <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,220px),1fr] md:items-start">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <EmsServiceIcon className="mb-1" />
              <p className="text-center text-xs text-earth-700 md:text-left">
                {t('publicSimulador.shippingGuideCaption30')}
              </p>
              <BoxDiagramAB idSuffix="ems" />
            </div>
            <BulletList
              keys={[
                'shippingGuideEmsB1',
                'shippingGuideEmsB2',
                'shippingGuideEmsB3',
                'shippingGuideEmsB4',
              ]}
            />
          </div>
        </div>

        {/* Parcel */}
        <div>
          <SectionHeader title={t('publicSimulador.shippingGuideParcelTitle')} href={JP_LINKS.parcel} />
          <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,220px),1fr] md:items-start">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <p className="text-center text-xs text-earth-700 md:text-left">
                {t('publicSimulador.shippingGuideCaption30')}
              </p>
              <BoxDiagramAB idSuffix="parcel" />
            </div>
            <BulletList keys={['shippingGuideParcelB1', 'shippingGuideParcelB2', 'shippingGuideParcelB3']} />
          </div>
        </div>

        {/* Small packets */}
        <div>
          <SectionHeader title={t('publicSimulador.shippingGuideSmallTitle')} href={JP_LINKS.smallPacket} />
          <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,240px),1fr] md:items-start">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <p className="text-center text-xs text-earth-700 md:text-left">
                {t('publicSimulador.shippingGuideCaption2')}
              </p>
              <BoxDiagramFlatABC />
            </div>
            <div>
              <BulletList keys={['shippingGuideSmallB1', 'shippingGuideSmallB2', 'shippingGuideSmallB3']} />
              <p className="mt-4 border-t border-earth-200 pt-4 text-sm text-earth-800">
                <span className="select-none text-red-700" aria-hidden>
                  &gt;{' '}
                </span>
                <Trans
                  i18nKey="publicSimulador.shippingGuideSmallRec"
                  components={{
                    strong: <strong className="font-semibold text-red-700" />,
                  }}
                />
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-earth-200 pt-4 text-xs leading-relaxed text-earth-600">
        <p>{t('publicSimulador.shippingGuideFn1')}</p>
        <p className="mt-2">{t('publicSimulador.shippingGuideFn2')}</p>
      </div>
    </section>
  )
}
