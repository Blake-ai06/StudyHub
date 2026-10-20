import { Bookmark, Flag, Heart, Lock, MessageCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { timeAgo, type PostView } from '../../lib/social'
import Avatar from './Avatar'
import CommentSection from './CommentSection'

interface Props {
  post: PostView
  meId: string
  isAdmin?: boolean
  onLike: (p: PostView) => void
  onBookmark: (p: PostView) => void
  onDelete: (p: PostView) => void
  onReport: (p: PostView) => void
  onCommentCountChange?: (postId: string, delta: number) => void
}

export default function PostCard({ post, meId, isAdmin, onLike, onBookmark, onDelete, onReport, onCommentCountChange }: Props) {
  const [open, setOpen] = useState(false)
  const mine = post.author_id === meId
  const btn = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100'
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_6px_20px_rgba(15,60,130,0.06)]" aria-label={`Post by ${post.author.full_name}`}>
      <header className="flex items-center gap-3">
        <Avatar name={post.author.full_name} url={post.author.avatar_url} />
        <div className="min-w-0 flex-1">
          <Link to={`/app/u/${post.author.username}`} className="block truncate font-semibold text-navy-900 hover:underline">{post.author.full_name}</Link>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            @{post.author.username} · {timeAgo(post.created_at)}
            {post.visibility === 'connections' && <span className="inline-flex items-center gap-0.5"><Lock className="h-3 w-3" aria-hidden />Connections</span>}
          </p>
        </div>
        {(mine || isAdmin) && (
          <button onClick={() => onDelete(post)} aria-label="Delete post" className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        )}
        {!mine && (
          <button onClick={() => onReport(post)} aria-label="Report post" className="grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Flag className="h-4 w-4" /></button>
        )}
      </header>
      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">{post.body}</p>
      {post.imageUrl && <img src={post.imageUrl} alt="Attached to the post" loading="lazy" className="mt-3 max-h-[28rem] w-full rounded-xl object-cover" />}
      <footer className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center">
          <button onClick={() => onLike(post)} aria-pressed={post.liked} aria-label={post.liked ? 'Unlike' : 'Like'} className={`${btn} ${post.liked ? 'text-rose-600' : ''}`}>
            <Heart className="h-5 w-5" fill={post.liked ? 'currentColor' : 'none'} />{post.likeCount}
          </button>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Comments" className={btn}>
            <MessageCircle className="h-5 w-5" />{post.commentCount}
          </button>
        </div>
        <button onClick={() => onBookmark(post)} aria-pressed={post.bookmarked} aria-label={post.bookmarked ? 'Remove bookmark' : 'Bookmark'} className={`${btn} ${post.bookmarked ? 'text-brand-dark' : ''}`}>
          <Bookmark className="h-5 w-5" fill={post.bookmarked ? 'currentColor' : 'none'} />
        </button>
      </footer>
      {open && <CommentSection postId={post.id} meId={meId} isAdmin={isAdmin} onCountChange={(d) => onCommentCountChange?.(post.id, d)} />}
    </article>
  )
}
