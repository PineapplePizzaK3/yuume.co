import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { getCollectorDemoWallet, isCollectorMockMode } from '../services/collectorService'
import { getWallet, WALLET_UPDATED_EVENT } from '../services/walletService'

export function useHeaderCredits() {
  const { user } = useAuth()
  const location = useLocation()
  const isMockMode = isCollectorMockMode()
  const [balance, setBalance] = useState(null)

  const refresh = useCallback(async () => {
    // Logged-in credits always come from the platform wallet, even in collector mock mode.
    if (user?.id) {
      const walletResult = await getWallet(user.id)
      if (walletResult?.error) return
      setBalance(Number(walletResult?.data?.balance || 0))
      return
    }
    if (isMockMode) {
      setBalance(Number(getCollectorDemoWallet().balance || 0))
      return
    }
    setBalance(null)
  }, [isMockMode, user?.id])

  useEffect(() => {
    void refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    const onUpdate = () => {
      void refresh()
    }
    window.addEventListener(WALLET_UPDATED_EVENT, onUpdate)
    window.addEventListener('focus', onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener(WALLET_UPDATED_EVENT, onUpdate)
      window.removeEventListener('focus', onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [refresh])

  return {
    balance,
    visible: Boolean(user?.id) || isMockMode,
  }
}
