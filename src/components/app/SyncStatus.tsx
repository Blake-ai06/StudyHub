import { CloudOff, RefreshCw, Wifi } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { checkReachability, isOffline, startConnectivity, subscribeConnectivity, useConnectivity } from '../../offline/connectivity'
import { db } from '../../offline/db'
import { syncNow } from '../../offline/outbox'
import { useLive } from '../../offline/useLive'

/** Keeps connectivity fresh and flushes the outbox: on start, when back online, when the app becomes visible, every 30 s. */
export function SyncController({ userId }: { userId: string }) {
  useEffect(() => {
    const stop = startConnectivity()
    const run = () => { if (!isOffline()) void syncNow(userId) }
    // When the connection comes back, send immediately and ignore the retry back-off from the outage.
    let wasOnline = !isOffline()
    const unsub = subscribeConnectivity(() => {
      const nowOnline = !isOffline()
      if (nowOnline && !wasOnline) void syncNow(userId, { force: true })
      wasOnline = nowOnline
    })
    const iv = setInterval(run, 30_000)
    const vis = () => { if (document.visibilityState === 'visible') void checkReachability().then(run) }
    document.addEventListener('visibilitychange', vis)
    void checkReachability().then(run)
    return () => { stop(); unsub(); clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [userId])
  return null
}

export default function SyncStatus({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const { online } = useConnectivity()
  const ops = useLive(() => db.outbox.where('userId').equals(userId).toArray(), [userId], [])
  const pending = ops.filter((o) => o.status === 'pending').length
  const problems = ops.filter((o) => o.status !== 'pending').length
  let label = 'Online', tone = 'bg-emerald-100 text-emerald-800', Icon = Wifi
  if (!online) { label = pending + problems ? `Offline · ${pending + problems} saved` : 'Offline'; tone = 'bg-amber-100 text-amber-900'; Icon = CloudOff }
  else if (problems) { label = `Sync error (${problems})`; tone = 'bg-red-100 text-red-800'; Icon = RefreshCw }
  else if (pending) { label = `Sync pending (${pending})`; tone = 'bg-sky-100 text-sky-800'; Icon = RefreshCw }
  return (
    <Link to="/app/offline" role="status" aria-live="polite" aria-label={`Connection status: ${label}. Open offline and sync settings.`} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className={compact && online && !pending && !problems ? 'sr-only' : ''}>{compact ? (!online ? 'Offline' : problems ? 'Error' : pending ? 'Pending' : label) : label}</span>
    </Link>
  )
}
