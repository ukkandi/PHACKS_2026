import { useEffect, useState } from 'react'

/** True once a service worker controls the page, i.e. the app will open with no network. */
export function useOfflineReady(): boolean {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
  const [ready, setReady] = useState(() => !!sw?.controller)
  useEffect(() => {
    if (!sw) return
    const on = () => setReady(!!sw.controller)
    sw.addEventListener('controllerchange', on)
    void sw.ready.then(on)
    return () => sw.removeEventListener('controllerchange', on)
  }, [sw])
  return ready
}
