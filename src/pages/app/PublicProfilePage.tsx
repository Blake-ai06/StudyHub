import { MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/app/Avatar'
import PostList from '../../components/app/PostList'
import { useAuth } from '../../lib/auth-context'
import { acceptRequest, fetchConnections, fetchFeed, relationTo, removeConnection, sendRequest, startConversation, type ConnectionRow, type PostView } from '../../lib/social'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/auth-context'

export default function PublicProfilePage() {
  const { username = '' } = useParams()
  const { session } = useAuth()
  const meId = session!.user.id
  const navigate = useNavigate()
  const [person, setPerson] = useState<Profile | null | undefined>(undefined)
  const [posts, setPosts] = useState<PostView[]>([])
  const [conns, setConns] = useState<ConnectionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data } = await supabase.from('profiles').select('id, username, full_name, role, avatar_url, bio').eq('username', username.toLowerCase()).maybeSingle()
      if (!live) return
      setPerson((data as Profile | null) ?? null)
      if (data) {
        const [p, c] = await Promise.all([fetchFeed(meId, { authorId: data.id }), fetchConnections()])
        if (live) { setPosts(p); setConns(c) }
      }
    })().catch(() => live && setError('This profile could not load.'))
    return () => { live = false }
  }, [username, meId])

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); setConns(await fetchConnections()) } catch (e) { setError((e as Error).message) }
  }

  if (person === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
  if (person === null) return <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{error ?? 'No one with that username.'}</p>
  const rel = relationTo(meId, person.id, conns)
  const btn = 'min-h-11 rounded-full px-5 text-sm font-semibold'
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5">
        <div className="flex items-center gap-4">
          <Avatar name={person.full_name} url={person.avatar_url} size={64} />
          <div className="min-w-0"><h1 className="truncate text-xl font-extrabold text-navy-900">{person.full_name}</h1><p className="text-sm text-slate-500">@{person.username} · <span className="capitalize">{person.role}</span></p></div>
        </div>
        {person.bio && <p className="mt-3 text-sm text-slate-700">{person.bio}</p>}
        {person.id !== meId && (
          <div className="mt-4 flex flex-wrap gap-2">
            {rel.kind === 'none' && <button onClick={() => void act(() => sendRequest(meId, person.id))} className={`${btn} bg-brand text-white`}>Connect</button>}
            {rel.kind === 'sent' && <button onClick={() => void act(() => removeConnection(rel.connectionId))} className={`${btn} border border-slate-300`}>Cancel request</button>}
            {rel.kind === 'received' && <button onClick={() => void act(() => acceptRequest(rel.connectionId))} className={`${btn} bg-brand text-white`}>Accept request</button>}
            {rel.kind === 'connected' && (
              <>
                <button onClick={() => void act(async () => navigate(`/app/messages/${await startConversation(person.id)}`))} className={`${btn} inline-flex items-center gap-2 bg-brand text-white`}><MessageSquare className="h-4 w-4" />Message</button>
                <button onClick={() => void act(() => removeConnection(rel.connectionId))} className={`${btn} border border-slate-300`}>Disconnect</button>
              </>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>
      <PostList posts={posts} setPosts={setPosts} meId={meId} empty={<p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No posts to show yet.</p>} />
    </div>
  )
}
