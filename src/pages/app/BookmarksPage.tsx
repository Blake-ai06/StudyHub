import { useEffect, useState } from 'react'
import PostList from '../../components/app/PostList'
import { useAuth } from '../../lib/auth-context'
import { fetchBookmarks, type PostView } from '../../lib/social'

export default function BookmarksPage() {
  const { session } = useAuth()
  const meId = session!.user.id
  const [posts, setPosts] = useState<PostView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => { fetchBookmarks(meId).then(setPosts).catch(() => setError(true)).finally(() => setLoading(false)) }, [meId])
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-navy-900">Bookmarks</h1>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Bookmarks could not load.</p>}
      {loading ? <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" /> : (
        <PostList posts={posts} setPosts={setPosts} meId={meId} empty={<p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Tap the bookmark icon on a post to save it here.</p>} />
      )}
    </div>
  )
}
