/**
 * Loja Virtual - Itens disponíveis para compra.
 * Usuário vê apenas produtos ativos. Clique no card abre modal com detalhes e botão Comprar.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { getProducts } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { useAuth } from '../../hooks/useAuth'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

function formatPriceBrlAsJpy(brl) {
  const jpy = Math.round(brlToJpy(brl))
  const approxBrl = jpyToBrl(jpy)
  return { jpy, approxBrl }
}

/** Retorna array de URLs de imagens do produto (image_urls ou image_url) */
function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) {
    return p.image_urls.filter(Boolean)
  }
  if (p?.image_url) return [p.image_url]
  return []
}

export default function Loja() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [detailProduct, setDetailProduct] = useState(null)
  const [detailImageIndex, setDetailImageIndex] = useState(0)

  useEffect(() => {
    let isActive = true
    const run = async () => {
      try {
        const { data, error } = await getProducts()
        if (!isActive) return
        setProducts(data ?? [])
        if (error) setMessage(error.message)
      } catch (e) {
        if (isActive) setMessage(e?.message || 'Erro ao carregar produtos')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [])

  const openDetail = (p) => {
    setDetailProduct(p)
    setDetailImageIndex(0)
  }

  const handleComprar = async (p) => {
    if (!user?.id) {
      setMessage('Faça login para comprar.')
      return
    }
    const { error } = await addToCart(user.id, p.id, 1)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Produto adicionado ao carrinho!')
    setDetailProduct(null)
  }

  const images = detailProduct ? getProductImages(detailProduct) : []

  return (
    <>
      <Helmet>
        <title>Loja Virtual | Plataforma</title>
      </Helmet>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-earth-900">Loja Virtual</h1>
            <p className="mt-2 text-earth-600">Clique em um produto para ver os detalhes e comprar.</p>
          </div>
          {user && (
            <Link
              to="/app/cart"
              className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
            >
              Ir para carrinho
            </Link>
          )}
        </div>
        {message && (
          <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>
        )}
        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}
        {!loading && products.length === 0 && (
          <p className="mt-6 text-earth-600">Nenhum produto disponível no momento.</p>
        )}
        {!loading && products.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const imgs = getProductImages(p)
              const mainImg = imgs[0]
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50 shadow-sm transition hover:border-earth-400 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => openDetail(p)}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset rounded-t-xl"
                  >
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={p.name}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-earth-200 text-earth-500">
                        Sem imagem
                      </div>
                    )}
                    <div className="p-4">
                      <h2 className="font-semibold text-earth-900">{p.name}</h2>
                      {p.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-earth-600">{p.description}</p>
                      )}
                      {(() => {
                        const v = formatPriceBrlAsJpy(p.price)
                        return (
                          <div className="mt-2">
                            <span className="block text-lg font-bold text-earth-900">{formatJPY(v.jpy)}</span>
                            <span className="block text-xs text-earth-600">Aprox.: {formatBRL(v.approxBrl)}</span>
                          </div>
                        )
                      })()}
                    </div>
                  </button>
                  <div className="flex gap-2 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleComprar(p)}
                      className="flex-1 rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Comprar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal detalhes do produto */}
        {detailProduct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetailProduct(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Galeria de fotos */}
              <div className="relative bg-earth-100">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[detailImageIndex]}
                      alt={detailProduct.name}
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
                <h2 id="product-detail-title" className="text-xl font-bold text-earth-900">
                  {detailProduct.name}
                </h2>
                {detailProduct.description && (
                  <p className="mt-2 text-earth-600">{detailProduct.description}</p>
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
                    onClick={() => handleComprar(detailProduct)}
                    className="rounded-xl bg-earth-900 px-6 py-3 font-medium text-white hover:bg-earth-800"
                  >
                    Comprar
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
