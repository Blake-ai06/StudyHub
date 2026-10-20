import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Composer from '../../components/app/Composer'
import PostList from '../../components/app/PostList'
import { useAuth } from '../../lib/auth-context'
import { fetchFeed, isOfflineError, type PostView } from '../../lib/social'

export default function FeedPage() {
  const { session, profile } = useAuth()
  const meId = session!.user.id
  const [posts, setPosts] = useState<PostView[]>([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try { const p = await fetchFeed(meId); setPosts(p); setMore(p.length === 20) } catch (e) { setError(isOfflineError(e as Error) ? 'You are offline. The feed could not refresh.' : 'The feed could not load. Try again.') }
    setLoading(false)
  }, [meId])
  useEffect(() => { void load() }, [load])

  async function loadMore() {
    const before = posts[posts.length - 1]?.created_at
    try { const p = await fetchFeed(meId, { before }); setPosts((x) => [...x, ...p]); setMore(p.length === 20) } catch { setError('More posts could not load.') }
  }

  return (
    <div className="space-y-4">
      {profile && <Composer meId={meId} name={profile.full_name} avatarUrl={profile.avatar_url} onPosted={() => void load()} />}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error} <button onClick={() => void load()} className="font-semibold underline">Retry</button></p>}
      {loading ? (
        <div className="space-y-4" aria-label="Loading feed">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
      ) : (
        <PostList posts={posts} setPosts={setPosts} meId={meId} isAdmin={profile?.role === 'admin'}
          empty={<div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500"><p className="font-semibold text-navy-900">Your feed is empty</p><p className="mt-1 text-sm">Write the first post above, or <Link to="/app/people" className="font-semibold text-brand-dark underline">find classmates</Link> to connect with.</p></div>} />
      )}
      {more && <button onClick={() => void loadMore()} className="mx-auto flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Loader2 className="hidden h-4 w-4" />Load more</button>}
    </div>
  )
}
