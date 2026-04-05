import { useCallback, useEffect, useState } from 'react'
import { getCart, CART_UPDATED_EVENT } from '../services/cartService'

function sumCartQuantity(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const q = Number(item?.quantity) || 0
    return acc + Math.max(0, q)
  }, 0)
}

export function useCartCount(userId) {
  const [cartCount, setCartCount] = useState(0)

  const refreshCartCount = useCallback(async () => {
    if (!userId) {
      setCartCount(0)
      return
    }
    const { data, error } = await getCart(userId)
    if (error) return
    setCartCount(sumCartQuantity(data))
  }, [userId])

  useEffect(() => {
    void refreshCartCount()
  }, [refreshCartCount])

  useEffect(() => {
    const onCartUpdated = (event) => {
      const targetUserId = event?.detail?.userId
      if (!targetUserId || targetUserId === userId) {
        void refreshCartCount()
      }
    }

    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated)
    window.addEventListener('focus', onCartUpdated)

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated)
      window.removeEventListener('focus', onCartUpdated)
    }
  }, [refreshCartCount, userId])

  return cartCount
}
