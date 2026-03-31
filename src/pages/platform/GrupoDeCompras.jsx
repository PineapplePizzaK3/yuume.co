/**
 * Grupo de Compras - página pública na plataforma (para usuários logados).
 * Cards com modal no mesmo estilo da página de `Loja`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getPurchaseGroups } from '../../services/groupService'
import { getPurchaseGroupProducts } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'
import LinkifyText from '../../components/LinkifyText'

function getGroupImages(g) {
  if (Array.isArray(g?.image_urls) && g.image_urls.length > 0) return g.image_urls.filter(Boolean)
  if (g?.image_url) return [g.image_url]
  return []
}

/** Retorna array de URLs de imagens do produto (image_urls ou image_url) */
function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) return p.image_urls.filter(Boolean)
  if (p?.image_url) return [p.image_url]
  return []
}

export default function GrupoDeCompras() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [groupProducts, setGroupProducts] = useState({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [modalFeedback, setModalFeedback] = useState('')
  const [detailGroup, setDetailGroup] = useState(null)
  const [detailImageIndex, setDetailImageIndex] = useState(0)
  const [detailProduct, setDetailProduct] = useState(null)
  const [detailProductImageIndex, setDetailProductImageIndex] = useState(0)

  const formatPriceBrlAsJpy = (brl) => {
    const jpy = Math.round(brlToJpy(brl))
    const approxBrl = jpyToBrl(jpy)
    return { jpy, approxBrl }
  }

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!modalFeedback) return
    const t = setTimeout(() => setModalFeedback(''), 2200)
    return () => clearTimeout(t)
  }, [modalFeedback])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      setLoading(true)
      setMessage('')
      try {
        const { data: groupsData, error } = await getPurchaseGroups()
        if (!isActive) return
        setGroups(groupsData ?? [])
        if (error) setMessage(error?.message)

        const groupIds = (groupsData ?? []).map((g) => g.id)
        const productsArrays = await Promise.all(
          groupIds.map((id) => getPurchaseGroupProducts(id).then((r) => r.data ?? []))
        )
        if (!isActive) return
        const map = Object.fromEntries(groupIds.map((id, i) => [id, productsArrays[i] ?? []]))
        setGroupProducts(map)
      } catch (e) {
        if (isActive) setMessage(e?.message || 'Erro ao carregar grupos de compra')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [])

  const images = useMemo(() => {
    return detailGroup ? getGroupImages(detailGroup) : []
  }, [detailGroup])

  const openDetail = (g) => {
    setDetailGroup(g)
    setDetailImageIndex(0)
    setDetailProduct(null)
    setModalFeedback('')
  }

  const openProductDetail = (product) => {
    setDetailProduct(product)
    setDetailProductImageIndex(0)
    setModalFeedback('')
  }

  const getGroupProducts = (group) => {
    return groupProducts[group?.id] ?? []
  }

  const isOutOfStock = (p) => p?.stock_quantity != null && Number(p.stock_quantity) <= 0
  const detailProductImages = detailProduct ? getProductImages(detailProduct) : []

  const handleComprar = async (product) => {
    if (!user?.id) {
      setMessage('Faça login para comprar.')
      return
    }
    const { error } = await addToCart(user.id, product.id, 1)
    const inModal = !!detailGroup
    if (error) {
      if (inModal) setModalFeedback(error.message || 'Erro ao adicionar ao carrinho')
      else setMessage(error.message)
      return
    }
    if (inModal) setModalFeedback('Produto adicionado ao carrinho!')
    else setMessage('Produto adicionado ao carrinho!')
  }

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-earth-600">
          <Link to="/login" className="font-medium text-earth-900 underline">
            Faça login
          </Link>{' '}
          para acessar o carrinho.
        </p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Grupo de Compras | Plataforma</title>
      </Helmet>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-earth-900">Grupo de Compras</h1>
            <p className="mt-2 text-earth-600">
              Veja grupos disponíveis e detalhes com fotos. Taxa de serviço: 20% sobre o valor dos produtos do grupo + ¥250 por
              unidade (no checkout a conversão para real segue a cotação configurada).
            </p>
          </div>
        </div>

        {message && !detailGroup && <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}
        {!loading && groups.length === 0 && <p className="mt-6 text-earth-600">Nenhum grupo disponível no momento.</p>}

        {!loading && groups.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const imgs = getGroupImages(g)
              const mainImg = imgs[0]
              const groupProducts = getGroupProducts(g)

              return (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50 shadow-sm transition hover:border-earth-400 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => openDetail(g)}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset rounded-t-xl"
                  >
                    {mainImg ? (
                      <img src={mainImg} alt={g.name} className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-earth-200 text-earth-500">Sem imagem</div>
                    )}
                    <div className="p-4">
                      <h2 className="font-semibold text-earth-900">{g.name}</h2>
                      {g.description && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-earth-600">
                          <LinkifyText text={g.description} />
                        </p>
                      )}
                      <p className="mt-2 text-xs text-earth-500">
                        Produtos no grupo: {groupProducts.length}
                      </p>
                    </div>
                  </button>

                  <div className="flex gap-2 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openDetail(g)}
                      className="flex-1 rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal detalhes do grupo */}
        {detailGroup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetailGroup(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-detail-title"
          >
            <div
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {modalFeedback && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                  <p className={`rounded-lg px-4 py-2 text-sm ${
                    modalFeedback.toLowerCase().includes('erro')
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {modalFeedback}
                  </p>
                </div>
              )}
              <div className="relative bg-earth-100">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[detailImageIndex]}
                      alt={detailGroup.name}
                      className="h-64 w-full object-contain sm:h-80"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                          aria-label="Foto anterior"
                        >
                          <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                          aria-label="Próxima foto"
                        >
                          <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="flex justify-center gap-1 pb-2">
                          {images.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailImageIndex(i)
                              }}
                              className={`h-2 w-2 rounded-full ${i === detailImageIndex ? 'bg-earth-800' : 'bg-earth-300'}`}
                              aria-label={`Foto ${i + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-64 items-center justify-center bg-earth-200 text-earth-500 sm:h-80">
                    Sem imagem
                  </div>
                )}
              </div>

              <div className="p-5">
                <h2 id="group-detail-title" className="text-xl font-bold text-earth-900">
                  {detailGroup.name}
                </h2>
                {detailGroup.description && (
                  <p className="mt-2 whitespace-pre-wrap text-earth-600">
                    <LinkifyText text={detailGroup.description} />
                  </p>
                )}

                <div className="mt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">Produtos disponíveis</h3>
                  {getGroupProducts(detailGroup).length === 0 ? (
                    <p className="mt-2 text-sm text-earth-600">Este grupo ainda não possui produtos vinculados.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {getGroupProducts(detailGroup).map((p) => {
                        const productImgs = getProductImages(p)
                        const productMainImg = productImgs[0]
                        const v = formatPriceBrlAsJpy(p.price)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => openProductDetail(p)}
                            className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50 text-left shadow-sm transition hover:border-earth-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-earth-500"
                          >
                            {productMainImg ? (
                              <img
                                src={productMainImg}
                                alt={p.name}
                                className="h-32 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-32 items-center justify-center bg-earth-200 text-earth-500 text-sm">
                                Sem imagem
                              </div>
                            )}
                            <div className="p-3">
                              <h4 className="line-clamp-2 text-sm font-semibold text-earth-900">{p.name}</h4>
                              <p className="mt-1 text-base font-bold text-earth-900">{formatJPY(v.jpy)}</p>
                              <p className="text-xs text-earth-600">Aprox.: {formatBRL(v.approxBrl)}</p>
                              <p className="mt-2 text-xs font-medium text-earth-500">Clique para ver detalhes</p>
                              <div className="mt-3 flex gap-2">
                                <span className="rounded-lg border border-earth-300 px-3 py-1.5 text-xs font-medium text-earth-700">
                                  Ver produto
                                </span>
                                <span
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                                    isOutOfStock(p)
                                      ? 'bg-earth-300 text-earth-600'
                                      : 'bg-earth-900 text-white'
                                  }`}
                                >
                                  {isOutOfStock(p) ? 'Esgotado' : 'Comprar'}
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailGroup(null)}
                    className="rounded-xl bg-earth-900 px-6 py-3 font-medium text-white hover:bg-earth-800"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-modal do produto (dentro do contexto do grupo) */}
        {detailGroup && detailProduct && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setDetailProduct(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-product-detail-title"
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-earth-100">
                {detailProductImages.length > 0 ? (
                  <>
                    <img
                      src={detailProductImages[detailProductImageIndex]}
                      alt={detailProduct.name}
                      className="h-64 w-full object-contain sm:h-80"
                    />
                    {detailProductImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailProductImageIndex((i) => (i === 0 ? detailProductImages.length - 1 : i - 1))
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                          aria-label="Foto anterior"
                        >
                          <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailProductImageIndex((i) => (i === detailProductImages.length - 1 ? 0 : i + 1))
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                          aria-label="Próxima foto"
                        >
                          <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="flex justify-center gap-1 pb-2">
                          {detailProductImages.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailProductImageIndex(i)
                              }}
                              className={`h-2 w-2 rounded-full ${i === detailProductImageIndex ? 'bg-earth-800' : 'bg-earth-300'}`}
                              aria-label={`Foto ${i + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-64 items-center justify-center bg-earth-200 text-earth-500 sm:h-80">
                    Sem imagem
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <h2 id="group-product-detail-title" className="text-xl font-bold text-earth-900">
                  {detailProduct.name}
                </h2>
                {detailProduct.description && (
                  <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-earth-200 bg-earth-50 p-3 text-earth-600">
                    <p className="whitespace-pre-wrap text-sm">
                      <LinkifyText text={detailProduct.description} />
                    </p>
                  </div>
                )}
                {(() => {
                  const v = formatPriceBrlAsJpy(detailProduct.price)
                  return (
                    <div className="mt-4">
                      <p className="text-2xl font-bold text-earth-900">{formatJPY(v.jpy)}</p>
                      <p className="text-sm text-earth-600">Aprox.: {formatBRL(v.approxBrl)}</p>
                    </div>
                  )
                })()}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => !isOutOfStock(detailProduct) && handleComprar(detailProduct)}
                    disabled={isOutOfStock(detailProduct)}
                    className="rounded-xl px-6 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-earth-300 disabled:text-earth-600 bg-earth-900 text-white hover:bg-earth-800"
                  >
                    {isOutOfStock(detailProduct) ? 'Esgotado' : 'Adicionar ao carrinho'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailProduct(null)}
                    className="rounded-xl border border-earth-200 px-6 py-3 font-medium text-earth-600 hover:bg-earth-50"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

