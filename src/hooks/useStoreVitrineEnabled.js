import { useEffect, useState } from 'react'
import {
  getStoreVitrineEnabled,
  STORE_VITRINE_CHANGED_EVENT,
} from '../services/settingsService'

/**
 * Controls visibility of the Loja "Vitrine" tab.
 * Defaults to false (hidden) until admin re-enables via system_settings.
 */
export function useStoreVitrineEnabled() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void getStoreVitrineEnabled().then((value) => {
      if (!active) return
      setEnabled(Boolean(value))
      setLoading(false)
    })
    const onChange = (event) => {
      setEnabled(Boolean(event?.detail?.enabled))
      setLoading(false)
    }
    window.addEventListener(STORE_VITRINE_CHANGED_EVENT, onChange)
    return () => {
      active = false
      window.removeEventListener(STORE_VITRINE_CHANGED_EVENT, onChange)
    }
  }, [])

  return { enabled, loading }
}
