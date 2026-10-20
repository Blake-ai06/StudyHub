import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/app/Avatar'
import { useAuth } from '../../lib/auth-context'
import { acceptRequest, fetchConnections, isOfflineError, relationTo, removeConnection, searchPeople, sendRequest, startConversation, type ConnectionRow, type PersonRow } from '../../lib/social'

export default function PeoplePage() {
  const { session } = useAuth()
  const meId = session!.user.id
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [people, setPeople] = useState<PersonRow[]>([])
  const [conns, setConns] = useState<ConnectionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (q: string) => {
    try { const [p, c] = await Promise.all([searchPeople(q, meId), fetchConnections()]); setPeople(p); setConns(c); setError(null) }
    catch (e) { setError(isOfflineError(e as Error) ? 'You are offline. People could not load.' : 'People could not load.') }
    setLoading(false)
  }, [meId])
  useEffect(() => { const t = setTimeout(() => void load(term), 250); return () => clearTimeout(t) }, [term, load])

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(term) } catch (e) { setError(isOfflineError(e as Error) ? 'You are offline. That change was not saved.' : (e as Error).message) }
  }
  const btn = 'min-h-11 rounded-full px-4 text-sm font-semibold'

  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-navy-900">People</h1>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <label htmlFor="people-search" className="sr-only">Search people</label>
        <input id="people-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name or username" className="min-h-12 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm focus:border-brand focus:outline-none" />
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-4 space-y-3">
        {loading && <li className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />}
        {!loading && people.length === 0 && <li className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No one found. Try a different name.</li>}
        {people.map((p) => {
          const rel = relationTo(meId, p.id, conns)
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3">
              <Avatar name={p.full_name} url={p.avatar_url} />
              <Link to={`/app/u/${p.username}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">{p.full_name}</p>
                <p className="truncate text-xs text-slate-500">@{p.username} · <span className="capitalize">{p.role}</span></p>
              </Link>
              {rel.kind === 'none' && <button onClick={() => void act(() => sendRequest(meId, p.id))} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>Connect</button>}
              {rel.kind === 'sent' && <button onClick={() => void act(() => removeConnection(rel.connectionId))} className={`${btn} border border-slate-300 text-slate-600`}>Cancel request</button>}
              {rel.kind === 'received' && (
                <span className="flex gap-2">
                  <button onClick={() => void act(() => acceptRequest(rel.connectionId))} className={`${btn} bg-brand text-white`}>Accept</button>
                  <button onClick={() => void act(() => removeConnection(rel.connectionId))} className={`${btn} border border-slate-300 text-slate-600`}>Decline</button>
                </span>
              )}
              {rel.kind === 'connected' && <button onClick={() => void act(async () => navigate(`/app/messages/${await startConversation(p.id)}`))} className={`${btn} border border-brand text-brand-dark`}>Message</button>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
