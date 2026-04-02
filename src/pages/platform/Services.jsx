/**
 * Services - Contratação de Redirecionamento e Personal Shopping.
 * Redirecionamento (Padrão ou Assistido): disclaimer → user cria pedido → admin aprova / orça.
 * Personal Shopping e Redirecionamento: anexos por arquivo ou URL; admin orça / aprova conforme o fluxo.
 */
import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getServices, createOrder } from '../../services/orderService'
import { uploadOrderAttachment } from '../../services/productService'

const SERVICOS_OFERTADOS = ['Redirecionamento', 'Personal Shopping']
const REDIRECIONAMENTO = 'Redirecionamento'
const PERSONAL_SHOPPING = 'Personal Shopping'

const DESCRICOES_FIXAS = {
  Redirecionamento: 'Módulos: 📦 Redirecionamento Padrão | 🛍️ Redirecionamento Assistido + frete',
  'Personal Shopping':
    '25% do valor da compra + ¥250 por item + frete — ideal para quem precisa de ajuda para decidir o que comprar',
}

const DRAFT_STORAGE_PREFIX = 'platform_services_order_draft_v1:'

function readServicesDraft(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_PREFIX + userId)
    if (!raw) return null
    const d = JSON.parse(raw)
    return d && typeof d === 'object' ? d : null
  } catch {
    return null
  }
}

function writeServicesDraft(userId, payload) {
  if (!userId) return
  try {
    localStorage.setItem(DRAFT_STORAGE_PREFIX + userId, JSON.stringify(payload))
  } catch {
    // quota ou modo privado
  }
}

function clearServicesDraft(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(DRAFT_STORAGE_PREFIX + userId)
  } catch {
    // ignore
  }
}

export default function Services() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState('')
  const [agreeProhibited, setAgreeProhibited] = useState(false)
  const [redirModule, setRedirModule] = useState('self_buy')
  const [attachmentUrls, setAttachmentUrls] = useState([])
  const [imageUrlDraft, setImageUrlDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [successNotice, setSuccessNotice] = useState(null)
  const [failedThumbUrls, setFailedThumbUrls] = useState(() => new Set())
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [earlyPrepaymentRequested, setEarlyPrepaymentRequested] = useState(false)
  const saveDebounceRef = useRef(null)
  const draftLoadedRef = useRef(false)

  const selectedService = selectedId ? services.find((s) => s.id === selectedId) : null
  const isRedirecionamento = selectedService?.name === REDIRECIONAMENTO
  const isPersonalShopping = selectedService?.name === PERSONAL_SHOPPING
  const isRedirAssisted = isRedirecionamento && redirModule === 'assisted_buy'
  const isRedirStandard = isRedirecionamento && redirModule === 'self_buy'
  const showImageAttachments = isPersonalShopping || isRedirAssisted || isRedirStandard
  const canSubmit = !isRedirecionamento || agreeProhibited

  useEffect(() => {
    let isActive = true
    const run = async () => {
      try {
        const { data, error } = await getServices()
        if (!isActive) return
        setServices(data ?? [])
        if (error) setFeedback(error.message)
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar serviços')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [])

  const oferta = services.filter((s) => SERVICOS_OFERTADOS.includes(s.name))

  useEffect(() => {
    draftLoadedRef.current = false
    setDraftHydrated(false)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || loading || oferta.length === 0) return
    if (draftLoadedRef.current) return
    draftLoadedRef.current = true
    const d = readServicesDraft(user.id)
    if (d) {
      if (typeof d.message === 'string') setMessage(d.message)
      if (d.redirModule === 'self_buy' || d.redirModule === 'assisted_buy') setRedirModule(d.redirModule)
      if (typeof d.agreeProhibited === 'boolean') setAgreeProhibited(d.agreeProhibited)
      if (Array.isArray(d.attachmentUrls)) {
        setAttachmentUrls(d.attachmentUrls.filter((u) => typeof u === 'string' && u.trim()))
      }
      if (typeof d.imageUrlDraft === 'string') setImageUrlDraft(d.imageUrlDraft)
      if (typeof d.earlyPrepaymentRequested === 'boolean') setEarlyPrepaymentRequested(d.earlyPrepaymentRequested)
      if (d.selectedId && oferta.some((s) => s.id === d.selectedId)) {
        setSelectedId(d.selectedId)
      }
    }
    setDraftHydrated(true)
  }, [user?.id, loading, oferta.length])

  useEffect(() => {
    if (!user?.id || !draftHydrated) return
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      writeServicesDraft(user.id, {
        message,
        selectedId,
        redirModule,
        agreeProhibited,
        attachmentUrls,
        imageUrlDraft,
        earlyPrepaymentRequested,
        updatedAt: Date.now(),
      })
    }, 450)
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [user?.id, draftHydrated, message, selectedId, redirModule, agreeProhibited, attachmentUrls, imageUrlDraft, earlyPrepaymentRequested])

  const clearLocalDraft = () => {
    setMessage('')
    setAttachmentUrls([])
    setImageUrlDraft('')
    setEarlyPrepaymentRequested(false)
    setFailedThumbUrls(() => new Set())
    clearServicesDraft(user?.id)
  }

  const addImageUrl = () => {
    const raw = imageUrlDraft.trim()
    if (!raw) return
    let u = raw
    if (!/^https?:\/\//i.test(u)) {
      setFeedback('Use uma URL completa começando com http:// ou https://')
      return
    }
    try {
      const parsed = new URL(u)
      if (!parsed.protocol.startsWith('http')) {
        setFeedback('Use uma URL http ou https.')
        return
      }
    } catch {
      setFeedback('URL inválida. Verifique o endereço.')
      return
    }
    setSuccessNotice(null)
    setFeedback('')
    setAttachmentUrls((prev) => [...prev, u])
    setImageUrlDraft('')
    setFailedThumbUrls((prev) => {
      const next = new Set(prev)
      next.delete(u)
      return next
    })
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    setFeedback('')
    setSuccessNotice(null)
    const { data, error } = await uploadOrderAttachment(file, user.id)
    setUploading(false)
    if (error) {
      setFeedback(error.message)
      return
    }
    if (data) {
      setAttachmentUrls((prev) => [...prev, data])
      setFailedThumbUrls((prev) => {
        const next = new Set(prev)
        next.delete(data)
        return next
      })
    }
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedId) {
      setFeedback('Selecione um serviço')
      return
    }
    setSubmitting(true)
    setFeedback('')
    setSuccessNotice(null)
    const { data, error } = await createOrder(user.id, {
      service_id: selectedId,
      message: message.trim() || null,
      attachment_urls: attachmentUrls,
      service_name: selectedService?.name,
      order_module: isRedirecionamento ? redirModule : null,
      early_prepayment_requested: isRedirAssisted && earlyPrepaymentRequested,
    })
    setSubmitting(false)
    if (error) {
      setFeedback(error.message)
      return
    }
    setSuccessNotice({
      quoteFlow: !!(isPersonalShopping || isRedirAssisted),
    })
    clearServicesDraft(user.id)
    setSelectedId(null)
    setMessage('')
    setAttachmentUrls([])
    setImageUrlDraft('')
    setEarlyPrepaymentRequested(false)
    setFailedThumbUrls(() => new Set())
  }

  return (
    <>
      <Helmet>
        <title>Serviços | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Contratar serviço</h1>
        <p className="mt-2 text-earth-600">
          Escolha Redirecionamento ou Personal Shopping e envie seu pedido. Recomendamos informar o que você irá pedir para enviar ao nosso endereço (ex.: loja, quantidade, descrição dos itens).
        </p>

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && oferta.length === 0 && (
          <p className="mt-6 text-earth-600">Nenhum serviço disponível no momento.</p>
        )}

        {!loading && oferta.length > 0 && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-medium text-earth-700">Escolha o serviço</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {oferta.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id)
                      setFeedback('')
                      setSuccessNotice(null)
                      setAgreeProhibited(false)
                      setRedirModule('self_buy')
                      setEarlyPrepaymentRequested(false)
                    }}
                    className={`rounded-xl border-2 p-5 text-left transition ${
                      selectedId === s.id
                        ? 'border-earth-900 bg-earth-100'
                        : 'border-earth-200 bg-earth-50 hover:border-earth-400'
                    }`}
                  >
                    <h3 className="font-semibold text-earth-900">{s.name}</h3>
                    <p className="mt-1 text-sm text-earth-600">
                      {DESCRICOES_FIXAS[s.name] ?? s.description}
                    </p>
                    {selectedId === s.id && (
                      <span className="mt-2 inline-block text-sm font-medium text-earth-700">
                        ✓ Selecionado
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {isRedirecionamento && (
              <div className="space-y-4">
                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <p className="text-sm font-medium text-earth-800">Modalidade de redirecionamento</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${redirModule === 'self_buy' ? 'border-earth-900 bg-earth-50' : 'border-earth-200 bg-white hover:bg-earth-50'}`}>
                      <input
                        type="radio"
                        name="redirModule"
                        checked={redirModule === 'self_buy'}
                        onChange={() => {
                          setRedirModule('self_buy')
                          setEarlyPrepaymentRequested(false)
                        }}
                        className="mt-1"
                      />
                      <div>
                        <span className="block font-semibold text-earth-900">📦 Redirecionamento Padrão</span>
                        <span className="block text-sm text-earth-600">
                          Taxa: 1 item ¥1.000 | 2–4 itens ¥750/item | 5+ itens ¥500/item + frete. Você compra nas lojas japonesas e envia para nosso endereço.
                        </span>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${redirModule === 'assisted_buy' ? 'border-earth-900 bg-earth-50' : 'border-earth-200 bg-white hover:bg-earth-50'}`}>
                      <input
                        type="radio"
                        name="redirModule"
                        checked={redirModule === 'assisted_buy'}
                        onChange={() => setRedirModule('assisted_buy')}
                        className="mt-1"
                      />
                      <div>
                        <span className="block font-semibold text-earth-900">🛍️ Redirecionamento Assistido</span>
                        <span className="block text-sm text-earth-600">
                          15% sobre o valor da compra + taxa por item igual ao Redirecionamento Padrão + frete. Você envia a lista e retornamos o orçamento para pré-pagamento.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {redirModule === 'self_buy' && (
                  <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-800">
                    <p>
                      <strong>Documentação da compra:</strong> se você já tiver a{' '}
                      <strong>nota fiscal (invoice)</strong> ou <strong>prints da tela da compra</strong> do produto,
                      anexe por upload ou envie o link da imagem. Isso ajuda a identificar o que foi pedido quando o pacote
                      chegar ao armazém.
                    </p>
                    <p className="mt-3">
                      <strong>Cobrança de taxas:</strong> as taxas de serviço (por item) e o frete internacional{' '}
                      <strong>só serão cobradas na etapa final</strong>, quando você solicitar o envio do(s) pacote(s) para o{' '}
                      <strong>seu endereço</strong>. Neste passo você apenas descreve o que pretende enviar ao nosso endereço no
                      Japão — sem cobrança dessas taxas agora.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreeProhibited}
                      onChange={(e) => setAgreeProhibited(e.target.checked)}
                      className="mt-1 rounded border-earth-300"
                    />
                    <span className="text-sm text-earth-800">
                      Li a lista de{' '}
                      <Link to="/faq/itens-proibidos" target="_blank" rel="noopener noreferrer" className="font-medium text-earth-900 underline hover:no-underline">
                        itens proibidos
                      </Link>
                      {' '}e confirmo que não enviarei nenhum item proibido na importação. O envio de itens proibidos pode resultar em apreensão, sem reembolso.
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div>
              {isRedirAssisted && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/90 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={earlyPrepaymentRequested}
                      onChange={(e) => setEarlyPrepaymentRequested(e.target.checked)}
                      className="mt-1 rounded border-earth-300"
                    />
                    <span className="text-sm text-earth-800">
                      <span className="font-semibold text-earth-900">Quero antecipar o pré-pagamento</span>
                      <span className="mt-1 block font-normal">
                        Marque se os itens vêm de <strong>flea market</strong> ou anúncios únicos (Mercari, Yahoo
                        Auctions/Fleamarket, Rakuma, etc.). Assim a equipe pode priorizar o envio do orçamento e da
                        cobrança para tentar comprar antes que outra pessoa leve o produto.
                      </span>
                    </span>
                  </label>
                  <p className="mt-3 text-xs text-earth-600">
                    O valor exato continua sendo definido no orçamento oficial; esta opção apenas indica urgência de
                    pré-pagamento por causa do risco de esgotamento.
                  </p>
                </div>
              )}
              <label htmlFor="message" className="block text-sm font-medium text-earth-700">
                {isPersonalShopping || isRedirAssisted
                  ? 'Descreva o que deseja comprar (links, lojas, quantidade)'
                  : 'O que você irá pedir para enviar ao nosso endereço? (recomendado)'}
              </label>
              <p className="mt-1 text-xs text-earth-500">
                {isPersonalShopping || isRedirAssisted
                  ? 'Envie a lista de produtos, links e referências. Você pode anexar imagens ou links de imagem abaixo.'
                  : isRedirStandard
                    ? 'Informe loja, quantidade e descrição dos itens. Você pode anexar invoice, prints ou links de imagem abaixo (opcional).'
                    : 'Informe loja, quantidade e descrição dos itens para facilitar o recebimento.'}
              </p>
              <p className="mt-1 text-xs text-earth-600">
                Seu texto e opções deste formulário são salvos automaticamente neste aparelho; se você sair da página, o rascunho volta ao retornar.
              </p>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isPersonalShopping || isRedirAssisted
                  ? 'Ex: Loja X – link do produto, tamanho M, cor azul. Ou: quero este modelo (anexe imagem).'
                  : 'Ex: Amazon JP – 2 livros; Rakuten – 1 figura.'}
                rows={4}
                className="mt-2 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={clearLocalDraft}
                  className="text-xs font-medium text-earth-600 underline decoration-earth-300 hover:text-earth-900 hover:decoration-earth-600"
                >
                  Limpar rascunho salvo neste aparelho
                </button>
              </div>
            </div>

            {showImageAttachments && (
              <div>
                <label className="block text-sm font-medium text-earth-700">
                  Imagens de referência (opcional)
                </label>
                <p className="mt-1 text-xs text-earth-500">
                  Envie um arquivo de imagem do seu dispositivo ou cole a URL direta da imagem (http ou https).
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
                    <span className="text-xs font-medium text-earth-600">URL da imagem</span>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="url"
                        value={imageUrlDraft}
                        onChange={(e) => setImageUrlDraft(e.target.value)}
                        placeholder="https://..."
                        className="min-w-0 flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                      />
                      <button
                        type="button"
                        onClick={addImageUrl}
                        className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
                      >
                        Adicionar URL
                      </button>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                    {uploading ? 'Enviando...' : 'Enviar arquivo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
                {attachmentUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachmentUrls.map((url, i) => (
                      <div key={`${url}-${i}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-earth-200 bg-earth-100">
                        {failedThumbUrls.has(url) ? (
                          <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-medium leading-tight text-earth-600">
                            {/^https?:\/\//i.test(url) ? 'Link' : 'Arquivo'}
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() =>
                              setFailedThumbUrls((prev) => {
                                const next = new Set(prev)
                                next.add(url)
                                return next
                              })
                            }
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setAttachmentUrls((p) => p.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                          aria-label="Remover"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {successNotice && (
              <p className="rounded-lg bg-green-100 px-4 py-2 text-sm text-green-800">
                {successNotice.quoteFlow ? (
                  <>
                    Pedido enviado! Em breve você receberá o orçamento para pré-pagamento. Acompanhe na página de{' '}
                    <Link to="/app/lounge?tab=pedidos" className="font-semibold text-green-900 underline hover:no-underline">
                      Pedidos
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Pedido enviado! O admin irá aprovar em breve. Acompanhe na página de{' '}
                    <Link to="/app/lounge?tab=pedidos" className="font-semibold text-green-900 underline hover:no-underline">
                      Pedidos
                    </Link>
                    .
                  </>
                )}
              </p>
            )}

            {feedback && (
              <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">{feedback}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedId || !canSubmit}
              className="rounded-lg bg-earth-900 px-6 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60 disabled:hover:bg-earth-900"
            >
              {submitting ? 'Enviando...' : 'Enviar pedido'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
