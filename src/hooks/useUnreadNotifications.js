import { useCallback, useEffect, useState } from 'react'
import { getMyNotifications } from '../services/notificationService'

function countUnread(notifications) {
  return (Array.isArray(notifications) ? notifications : []).reduce(
    (acc, item) => acc + (item?.read_at ? 0 : 1),
    0
  )
}

export function useUnreadNotifications(userId, limit = 20) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnread = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0)
      return
    }
    const { data, error } = await getMyNotifications(userId, limit)
    if (error) return
    setUnreadCount(countUnread(data))
  }, [limit, userId])

  useEffect(() => {
    let isActive = true

    const run = async () => {
      if (!isActive) return
      await refreshUnread()
    }

    void run()
    const interval = setInterval(run, 30000)

    const onFocus = () => {
      void run()
    }

    window.addEventListener('focus', onFocus)

    return () => {
      isActive = false
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshUnread])

  return unreadCount
}
