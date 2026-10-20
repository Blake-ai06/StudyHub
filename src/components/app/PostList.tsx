import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { deletePost, isOfflineError, reportPost, setBookmark, setReaction, type PostView } from '../../lib/social'
import PostCard from './PostCard'

/** Renders posts and owns the like / bookmark / delete / report actions (optimistic, with rollback). */
export default function PostList({ posts, setPosts, meId, isAdmin, empty }: { posts: PostView[]; setPosts: React.Dispatch<React.SetStateAction<PostView[]>>; meId: string; isAdmin?: boolean; empty: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const patch = (id: string, f: (p: PostView) => PostView) => setPosts((ps) => ps.map((p) => (p.id === id ? f(p) : p)))
  const fail = (e: unknown, what: string) => setError(isOfflineError(e as Error) ? `You are offline. ${what} was not saved.` : `${what} could not be saved. Try again.`)

  async function like(p: PostView) {
    setError(null)
    patch(p.id, (x) => ({ ...x, liked: !p.liked, likeCount: x.likeCount + (p.liked ? -1 : 1) }))
    try { await setReaction(p.id, meId, !p.liked) } catch (e) { patch(p.id, () => p); fail(e, 'Your like') }
  }
  async function bookmark(p: PostView) {
    setError(null)
    patch(p.id, (x) => ({ ...x, bookmarked: !p.bookmarked }))
    try { await setBookmark(p.id, meId, !p.bookmarked) } catch (e) { patch(p.id, () => p); fail(e, 'Your bookmark') }
  }
  async function remove(p: PostView) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setBusy(true); setError(null)
    try { await deletePost(p); setPosts((ps) => ps.filter((x) => x.id !== p.id)) } catch (e) { fail(e, 'The deletion') }
    setBusy(false)
  }
  async function report(p: PostView) {
    const reason = window.prompt('Why are you reporting this post?')
    if (!reason || reason.trim().length < 3) return
    try { await reportPost(p.id, meId, reason.trim()); setError(null); window.alert('Thanks. A moderator will review this post.') } catch (e) { fail(e, 'Your report') }
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {busy && <Loader2 className="h-5 w-5 animate-spin text-brand" aria-label="Working" />}
      {posts.length === 0 ? empty : posts.map((p) => (
        <PostCard key={p.id} post={p} meId={meId} isAdmin={isAdmin} onLike={(x) => void like(x)} onBookmark={(x) => void bookmark(x)} onDelete={(x) => void remove(x)} onReport={(x) => void report(x)}
          onCommentCountChange={(id, d) => patch(id, (x) => ({ ...x, commentCount: Math.max(0, x.commentCount + d) }))} />
      ))}
    </div>
  )
}
