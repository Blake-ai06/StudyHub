import { ArrowLeft, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../../components/app/Avatar'
import { useAuth } from '../../lib/auth-context'
import { fetchConversations, fetchMessages, timeAgo, type ConversationView, type MessageRow } from '../../lib/social'
import { db } from '../../offline/db'
import { clearDraft, getDraft, useDraftSaver } from '../../offline/drafts'
import { runOrQueue } from '../../offline/outbox'
import type { OutboxOp } from '../../offline/types'
import { useLive } from '../../offline/useLive'
import { supabase } from '../../lib/supabase'

export function ConversationList() {
  const { session } = useAuth()
  const [list, setList] = useState<ConversationView[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => { fetchConversations(session!.user.id).then(setList).catch(() => { setError(true); setList([]) }) }, [session])
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-navy-900">Messages</h1>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Conversations could not load.</p>}
      {list === null ? <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70" /> : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No conversations yet. Connect with someone in <Link to="/app/people" className="font-semibold text-brand-dark underline">People</Link>, then message them.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/app/messages/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 hover:bg-slate-50">
                <Avatar name={c.other.full_name} url={c.other.avatar_url} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-navy-900">{c.other.full_name}</p><p className="truncate text-sm text-slate-500">{c.last?.body ?? 'No messages yet'}</p></div>
                {c.last && <span className="text-xs text-slate-400">{timeAgo(c.last.created_at)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ThreadPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const meId = session!.user.id
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [other, setOther] = useState<string>('Conversation')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const saveDraftLater = useDraftSaver(meId, `message:${id}`)
  // Messages typed offline stay in the outbox until the server confirms; show them as "Sending…".
  const queued = useLive(async () => (await db.outbox.where('userId').equals(meId).toArray()).filter((o) => o.type === 'message.send' && (o.payload as { conversationId: string }).conversationId === id) as OutboxOp<'message.send'>[], [meId, id], [] as OutboxOp<'message.send'>[])
  const unsent = queued.filter((q) => !messages.some((m) => m.id === q.payload.id))

  const load = useCallback(async () => { try { setMessages(await fetchMessages(id)) } catch { setError('Messages could not load.') } }, [id])
  useEffect(() => {
    void load()
    void getDraft(meId, `message:${id}`).then((d) => { if (d) setText(d) })
    fetchConversations(meId).then((l) => setOther(l.find((c) => c.id === id)?.other.full_name ?? 'Conversation')).catch(() => {})
    const ch = supabase.channel(`conv-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        const m = p.new as MessageRow
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [id, meId, load])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length, unsent.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setError(null)
    const msg: MessageRow = { id: crypto.randomUUID(), conversation_id: id, sender_id: meId, body, created_at: new Date().toISOString() }
    try {
      const r = await runOrQueue('message.send', meId, `Message: ${body.slice(0, 40)}`, { id: msg.id, conversationId: id, senderId: meId, body }, msg.id)
      if (r === 'sent') setMessages((c) => (c.some((x) => x.id === msg.id) ? c : [...c, msg]))
      setText(''); void clearDraft(meId, `message:${id}`)
    } catch { setError('Your message could not be sent. Try again.') }
    setSending(false)
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-5rem)]">
      <div className="mb-3 flex items-center gap-2"><Link to="/app/messages" aria-label="Back to messages" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link><h1 className="text-lg font-extrabold text-navy-900">{other}</h1></div>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl bg-white p-3" aria-live="polite">
        {messages.length + unsent.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Say hello.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === meId ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.sender_id === meId ? 'bg-brand text-white' : 'bg-slate-100 text-slate-800'}`}>{m.body}</p>
          </div>
        ))}
        {unsent.map((q) => (
          <div key={q.id} className="flex justify-end">
            <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-brand/60 px-3 py-2 text-sm text-white">{q.payload.body}<span className="mt-1 block text-[11px] opacity-90">{q.status === 'pending' ? 'Not sent yet. Waiting for a connection.' : 'Could not be sent. See Offline & sync.'}</span></p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={(e) => void send(e)} className="mt-2 flex gap-2">
        <label htmlFor="msg" className="sr-only">Message</label>
        <input id="msg" value={text} maxLength={2000} onChange={(e) => { setText(e.target.value); saveDraftLater(e.target.value) }} placeholder="Write a message…" className="min-h-12 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm focus:border-brand focus:outline-none" />
        <button disabled={sending || !text.trim()} aria-label="Send message" className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white disabled:opacity-50"><Send className="h-5 w-5" /></button>
      </form>
    </div>
  )
}
