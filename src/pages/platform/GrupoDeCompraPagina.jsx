/**
 * Página de detalhe de um grupo de compras (substitui o modal da vitrine).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { appStoreProductPath, publicStoreProductPath } from '../../lib/localeRoutes'
import { PageSeo } from '../../components/PageSeo'
import { getPurchaseGroupById } from '../../services/groupService'
import { getPurchaseGroupProducts } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { showCartToast } from '../../lib/cartToast'
import GroupPurchaseDetailContent from '../../components/GroupPurchaseDetailContent'

export default function GrupoDeCompraPagina({ publicMode = false }) {
  const { t } = useTranslation()
  const { groupId: rawGroupId } = useParams()
  const groupId = rawGroupId ? decodeURIComponent(rawGroupId) : ''
  const lp = useLocalizedPath()
  const locale = useSiteLocale()
  const { user } = useAuth()
  const tt = (key, options) => t(`platform.groupBuy.${key}`, options)

  const [group, setGroup] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const backHref = publicMode ? lp('lojaPublicVitrine') : lp('appLoja')
  const getPreferredVariantId = (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants.filter((v) => v?.is_active !== false) : []
    return (variants.find((v) => v?.is_default) || variants[0])?.id || ''
  }
  const productHref = (product) => {
    const variantId = getPreferredVariantId(product)
    return publicMode
      ? publicStoreProductPath(product?.id, locale, variantId ? { variantId } : {})
      : appStoreProductPath(product?.id, locale, variantId ? { variantId } : {})
  }

  useEffect(() => {
    if (!message) return
    const tmr = setTimeout(() => setMessage(''), 3200)
    return () => clearTimeout(tmr)
  }, [message])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!groupId) {
        setGroup(null)
        setProducts([])
        setLoading(false)
        return
      }
      setLoading(true)
      setMessage('')
      try {
        const { data: g, error: errGroup } = await getPurchaseGroupById(groupId)
        if (!active) return
        if (errGroup || !g) {
          setGroup(null)
          setProducts([])
          setMessage(errGroup?.message || t('platform.groupBuy.groupNotFound'))
          return
        }
        setGroup(g)
        const { data: prods, error: errProds } = await getPurchaseGroupProducts(groupId)
        if (!active) return
        if (errProds) setMessage(errProds.message)
        setProducts(Array.isArray(prods) ? prods : [])
      } catch (e) {
        if (active) {
          setGroup(null)
          setProducts([])
          setMessage(e?.message || t('platform.groupBuy.loadError'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [groupId, t])

  const isOutOfStock = (p) => {
    const variants = Array.isArray(p?.variants) ? p.variants.filter((v) => v?.is_active !== false) : []
    if (variants.length > 0) {
      return variants.every((v) => v?.stock_quantity != null && Number(v.stock_quantity) <= 0)
    }
    return p?.stock_quantity != null && Number(p.stock_quantity) <= 0
  }

  const handleComprar = async (product) => {
    if (!user?.id) {
      setMessage(tt('loginToBuy'))
      return
    }
    const variantId = getPreferredVariantId(product)
    if (!variantId) {
      setMessage('Produto sem versão disponível no momento.')
      return
    }
    const { error } = await addToCart(user.id, product.id, 1, variantId)
    if (error) setMessage(error.message || tt('addError'))
    else showCartToast(tt('added'))
  }

  const pageTitle = group?.name
    ? `${group.name} | ${t('platform.groupBuy.pageTitle')}`
    : t('platform.groupBuy.pageTitle')

  return (
    <>
      <PageSeo
        routeKey={publicMode ? 'lojaPublicVitrine' : 'appLoja'}
        title={pageTitle}
        description={t('meta.appStore.description')}
        noindex
      />
      <div className={publicMode ? 'px-4 pt-24 pb-12' : ''}>
        <div className="mx-auto w-full max-w-7xl">
          <Link
            to={backHref}
            className="inline-flex text-sm font-medium text-earth-600 hover:text-earth-900"
          >
            ← {t('platform.store.productPageBack')}
          </Link>

          {loading && <p className="mt-8 text-earth-600">{tt('loading')}</p>}

          {!loading && !group && (
            <p className="mt-8 rounded-lg bg-earth-100 px-4 py-3 text-earth-800">
              {message || t('platform.groupBuy.groupNotFound')}
            </p>
          )}

          {!loading && group && (
            <article className="mt-6 overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm">
              {message && (
                <p className="border-b border-earth-200 bg-earth-50 px-4 py-3 text-sm text-earth-800">{message}</p>
              )}
              <GroupPurchaseDetailContent
                key={group.id}
                group={group}
                products={products}
                productHref={productHref}
                onComprar={handleComprar}
                isOutOfStock={isOutOfStock}
                tt={tt}
              />
            </article>
          )}
        </div>
      </div>
    </>
  )
}
