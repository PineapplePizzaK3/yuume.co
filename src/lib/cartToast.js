const CART_TOAST_EVENT = 'ddelivery:cart-toast'

export function showCartToast(message, durationMs = 2800) {
  if (typeof window === 'undefined') return
  const text = String(message || '').trim()
  if (!text) return
  window.dispatchEvent(
    new CustomEvent(CART_TOAST_EVENT, {
      detail: {
        message: text,
        durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 2800,
      },
    })
  )
}

export { CART_TOAST_EVENT }
