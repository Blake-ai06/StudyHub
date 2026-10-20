import { CloudOff, HardDrive, Loader2, RefreshCw, Trash2, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorNote, OkNote } from '../../components/app/Notes'
import { btnDanger, btnGhost, btnPrimary, card, fmtDate } from '../../components/app/ui'
import { useAuth } from '../../lib/auth-context'
import { checkReachability, useConnectivity } from '../../offline/connectivity'
import { db, getLastSync } from '../../offline/db'
import { formatBytes, openDownload, removeDownload, storageEstimate } from '../../offline/downloads'
import { discardOp, resolveConflict, retryOp, syncNow } from '../../offline/outbox'
import { timeAgo } from '../../lib/social'
import { useLive } from '../../offline/useLive'

const statusText = { pending: 'Waiting to sync', failed: 'Failed', conflict: 'Conflict' } as const

export default function OfflinePage() {
  const { session } = useAuth()
  const uid = session!.user.id
  const { online, checking } = useConnectivity()
  const ops = useLive(() => db.outbox.where('userId').equals(uid).sortBy('createdAt'), [uid], [])
  const files = useLive(async () => (await db.downloads.where('userId').equals(uid).toArray()).map((d) => ({ id: d.id, title: d.title, fileName: d.fileName, size: d.size, savedAt: d.savedAt })), [uid], [])
  const lastSync = useLive(() => getLastSync(uid), [uid], null as number | null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [est, setEst] = useState<Awaited<ReturnType<typeof storageEstimate>>>(null)
  useEffect(() => { void storageEstimate().then(setEst) }, [files.length])

  async function doSync() {
    setSyncing(true); setMsg(null)
    const reachable = await checkReachability() // do not trust navigator.onLine alone
    if (!reachable) { setMsg({ ok: false, t: 'The server cannot be reached right now. Your changes stay saved on this device.' }); setSyncing(false); return }
    const r = await syncNow(uid, { force: true })
    setMsg(r.skipped ? { ok: true, t: 'A sync is already running in another tab.' } : r.offline ? { ok: false, t: 'The connection dropped during sync. It will retry automatically.' } : { ok: true, t: `Sync finished. ${r.sent} sent${r.failed ? `, ${r.failed} failed` : ''}${r.conflicts ? `, ${r.conflicts} need a decision` : ''}.` })
    setSyncing(false)
  }
  async function clearCache() {
    if (!window.confirm('Remove saved lessons and cached pages from this device? Unsynced changes and drafts are kept.')) return
    await Promise.all([db.cache.where('userId').equals(uid).delete(), db.downloads.where('userId').equals(uid).delete()])
    setMsg({ ok: true, t: 'Saved lessons and cached pages were removed from this device.' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold text-navy-900">Offline &amp; sync</h1>

      <section className={`${card} space-y-3`} aria-label="Connection">
        <p className="flex items-center gap-2 font-semibold text-navy-900">{online ? <Wifi className="h-5 w-5 text-emerald-600" /> : <CloudOff className="h-5 w-5 text-amber-600" />}{online ? 'Online. The server is reachable.' : 'Offline. Changes are saved on this device.'}</p>
        <p className="text-sm text-slate-600">Last successful sync: {lastSync ? `${fmtDate(new Date(lastSync).toISOString())} (${timeAgo(new Date(lastSync).toISOString())})` : 'not yet'}</p>
        <button onClick={() => void doSync()} disabled={syncing || checking} className={btnPrimary}>{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Sync now</button>
        {msg && (msg.ok ? <OkNote>{msg.t}</OkNote> : <ErrorNote>{msg.t}</ErrorNote>)}
      </section>

      <section aria-label="Pending changes">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Pending changes ({ops.length})</h2>
        {ops.length === 0 ? <Empty>Nothing waiting. Everything you did has been received by the server.</Empty> : (
          <ul className="space-y-3">
            {ops.map((o) => (
              <li key={o.id} className={`${card} space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate font-semibold text-navy-900">{o.label}</p><p className="text-xs text-slate-500">Saved {timeAgo(new Date(o.createdAt).toISOString())} · {o.attempts} attempt{o.attempts === 1 ? '' : 's'}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${o.status === 'pending' ? 'bg-sky-100 text-sky-800' : o.status === 'conflict' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`}>{statusText[o.status]}</span>
                </div>
                {o.lastError && <p className="text-sm text-slate-600">{o.lastError}</p>}
                <div className="flex flex-wrap gap-2">
                  {o.status === 'failed' && <button onClick={() => void retryOp(o.id).then(() => syncNow(uid, { force: true }))} className={btnGhost}>Retry</button>}
                  {o.status === 'conflict' && o.type === 'submission.save' && o.conflictKind === 'changed' && <button onClick={() => void resolveConflict(o.id, 'keep-mine').then(() => syncNow(uid, { force: true }))} className={btnGhost}>Keep mine</button>}
                  {o.status === 'conflict' && <button onClick={() => void resolveConflict(o.id, 'use-server')} className={btnGhost}>Use the server version</button>}
                  {o.status !== 'conflict' && <button onClick={() => { if (window.confirm('Delete this saved change? It will never be sent.')) void discardOp(o.id) }} className={btnDanger}>Discard</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Downloaded materials">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Downloaded materials ({files.length})</h2>
        {files.length === 0 ? <Empty>Nothing saved for offline yet. In a class, open Materials and tap Save offline.</Empty> : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className={`${card} flex items-center gap-3 !p-3`}>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-navy-900">{f.title}</p><p className="truncate text-xs text-slate-500">{f.fileName} · {formatBytes(f.size)} · saved {timeAgo(new Date(f.savedAt).toISOString())}</p></div>
                <button onClick={() => void openDownload(f.id).catch((e) => setMsg({ ok: false, t: (e as Error).message }))} className={btnGhost}>Open</button>
                <button onClick={() => void removeDownload(f.id)} aria-label={`Remove ${f.title}`} className="grid h-11 w-11 place-items-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} space-y-2`} aria-label="Storage">
        <h2 className="flex items-center gap-2 font-bold text-navy-900"><HardDrive className="h-5 w-5 text-brand" />Storage on this device</h2>
        {est ? (
          <>
            <p className="text-sm text-slate-600">StudyHub and other site data use about {formatBytes(est.usage)} of roughly {formatBytes(est.quota)} available. {est.persisted ? 'The browser has agreed to keep your saved lessons.' : 'The browser may clear saved lessons if the device runs low on space.'}</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand" style={{ width: `${Math.min(100, est.quota ? (est.usage / est.quota) * 100 : 0)}%` }} /></div>
          </>
        ) : <p className="text-sm text-slate-600">This browser does not report storage usage.</p>}
        <button onClick={() => void clearCache()} className={btnDanger}>Clear saved lessons and cached pages</button>
        <p className="text-xs text-slate-500">Cached pages and downloads are removed automatically when you log out. <Link to="/privacy" className="underline">Privacy policy</Link></p>
      </section>
    </div>
  )
}
