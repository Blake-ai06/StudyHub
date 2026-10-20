import { RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Service worker registration plus the "ready offline" and "new version" messages. (The install reminder is InstallToast.) */
export default function PwaPrompts() {
  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW()
  useEffect(() => { if (!offlineReady) return; const t = setTimeout(() => setOfflineReady(false), 6000); return () => clearTimeout(t) }, [offlineReady, setOfflineReady])
  const box = 'pointer-events-auto flex items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-sm text-white shadow-xl'
  if (!needRefresh && !offlineReady) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-36 z-50 flex flex-col items-center gap-2 px-4 md:bottom-16" aria-live="polite">
      {offlineReady && <div className={box} role="status"><span>StudyHub is ready to work offline.</span><button aria-label="Dismiss" onClick={() => setOfflineReady(false)}><X className="h-4 w-4" /></button></div>}
      {needRefresh && <div className={box} role="status"><span>A new version is available.</span><button onClick={() => void updateServiceWorker(true)} className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 font-semibold"><RefreshCw className="h-3.5 w-3.5" />Reload</button></div>}
    </div>
  )
}
