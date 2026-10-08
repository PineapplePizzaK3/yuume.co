import { useCallback, useEffect, useRef, useState } from 'react'
import { nextEphemeralExpiryDelayMs } from '../lib/ephemeralCartExpiry'
import { getCart, CART_UPDATED_EVENT } from '../services/cartService'

function sumCartQuantity(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const q = Number(item?.quantity) || 0
    return acc + Math.max(0, q)
  }, 0)
}

export function useCartCount(userId) {
  const [cartCount, setCartCount] = useState(0)
  const expiryTimerRef = useRef(null)

  const clearExpiryTimer = () => {
    if (expiryTimerRef.current == null) return
    window.clearTimeout(expiryTimerRef.current)
    expiryTimerRef.current = null
  }

  const refreshCartCount = useCallback(async () => {
    if (!userId) {
      setCartCount(0)
      clearExpiryTimer()
      return
    }
    const { data, error } = await getCart(userId)
    if (error) return
    setCartCount(sumCartQuantity(data))
    clearExpiryTimer()
    const delay = nextEphemeralExpiryDelayMs(data)
    if (delay == null) return
    expiryTimerRef.current = window.setTimeout(() => {
      void refreshCartCount()
    }, delay + 250)
  }, [userId])

  useEffect(() => {
    void refreshCartCount()
    return () => clearExpiryTimer()
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
