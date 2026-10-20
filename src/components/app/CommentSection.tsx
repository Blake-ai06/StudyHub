import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { commentSchema } from '../../lib/schemas'
import { deleteComment, fetchComments, isOfflineError, timeAgo, type CommentView } from '../../lib/social'
import { clearDraft, getDraft, useDraftSaver } from '../../offline/drafts'
import { runOrQueue } from '../../offline/outbox'
import Avatar from './Avatar'

export default function CommentSection({ postId, meId, isAdmin, onCountChange }: { postId: string; meId: string; isAdmin?: boolean; onCountChange: (delta: number) => void }) {
  const [comments, setComments] = useState<CommentView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<CommentView | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<{ body: string }>({ resolver: zodResolver(commentSchema) })
  const saveDraftLater = useDraftSaver(meId, `comment:${postId}`)
  useEffect(() => { void getDraft(meId, `comment:${postId}`).then((d) => { if (d) reset({ body: d }) }) }, [meId, postId, reset])
  useEffect(() => { const sub = watch((v) => saveDraftLater(v.body ?? '')); return () => sub.unsubscribe() }, [watch, saveDraftLater])

  const load = useCallback(async () => {
    try { setComments(await fetchComments(postId)) } catch (e) { setError(isOfflineError(e as Error) ? 'You are offline. Comments could not load.' : 'Comments could not load.') }
  }, [postId])
  useEffect(() => { void load() }, [load])

  async function onSubmit(v: { body: string }) {
    setError(null); setNotice(null)
    try {
      const r = await runOrQueue('comment.create', meId, `Comment: ${v.body.trim().slice(0, 40)}`, { id: crypto.randomUUID(), postId, authorId: meId, parentId: replyTo?.id ?? null, body: v.body })
      reset({ body: '' }); void clearDraft(meId, `comment:${postId}`); setReplyTo(null)
      if (r === 'queued') setNotice('Saved on this device. It will post when you are back online.')
      else { onCountChange(1); await load() }
    } catch { setError('Your comment could not be sent. Try again.') }
  }
  async function remove(c: CommentView) {
    try { await deleteComment(c.id); onCountChange(-1); await load() } catch { setError('The comment could not be deleted.') }
  }

  const top = (comments ?? []).filter((c) => !c.parent_id)
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id)
  const row = (c: CommentView, nested: boolean) => (
    <li key={c.id} className={nested ? 'ml-10' : ''}>
      <div className="flex gap-2">
        <Avatar name={c.author.full_name} url={c.author.avatar_url} size={32} />
        <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-3 py-2">
          <p className="text-xs"><Link to={`/app/u/${c.author.username}`} className="font-semibold text-navy-900 hover:underline">{c.author.full_name}</Link> <span className="text-slate-500">{timeAgo(c.created_at)}</span></p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{c.body}</p>
        </div>
        {(c.author_id === meId || isAdmin) && <button onClick={() => void remove(c)} aria-label="Delete comment" className="grid h-9 w-9 place-items-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
      </div>
      {!nested && <button onClick={() => setReplyTo(c)} className="ml-10 mt-1 text-xs font-semibold text-brand-dark">Reply</button>}
    </li>
  )

  return (
    <section className="mt-3 border-t border-slate-100 pt-3" aria-label="Comments">
      {comments === null && !error && <Loader2 className="h-5 w-5 animate-spin text-brand" aria-label="Loading comments" />}
      <ul className="space-y-3">
        {top.map((c) => (
          <div key={c.id} className="space-y-2">
            {row(c, false)}
            {repliesOf(c.id).map((r) => row(r, true))}
          </div>
        ))}
      </ul>
      {comments?.length === 0 && <p className="text-sm text-slate-500">No comments yet. Start the conversation.</p>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3">
        {replyTo && <p className="mb-1 text-xs text-slate-500">Replying to {replyTo.author.full_name} <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-brand-dark">Cancel</button></p>}
        <div className="flex gap-2">
          <label htmlFor={`c-${postId}`} className="sr-only">Write a comment</label>
          <input id={`c-${postId}`} placeholder="Write a comment…" className="min-h-11 flex-1 rounded-full border border-slate-200 bg-slate-100/80 px-4 text-sm focus:border-brand focus:bg-white focus:outline-none" {...register('body')} />
          <button disabled={isSubmitting} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">Send</button>
        </div>
        {errors.body && <p role="alert" className="mt-1 text-xs text-red-600">{errors.body.message}</p>}
      </form>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</p>}
    </section>
  )
}
