import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Empty, ErrorNote, Skeleton } from '../../../components/app/Notes'
import { btnPrimary, card, errText, fmtDate, inputCls } from '../../../components/app/ui'
import { deleteAnnouncement, fetchAnnouncements, postAnnouncement, type Announcement } from '../../../lib/classroom'
import type { TabProps } from './types'

export default function StreamTab({ cls, meId, isTeacher }: TabProps) {
  const [items, setItems] = useState<Announcement[] | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setItems(await fetchAnnouncements(cls.id)) } catch (e) { setItems([]); setError(errText(e, 'Announcements')) } }, [cls.id])
  useEffect(() => { void load() }, [load])

  async function post(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (!body.trim()) return setError('Write an announcement first.')
    setBusy(true)
    try { await postAnnouncement({ classId: cls.id, authorId: meId, body }); setBody(''); await load() } catch (err) { setError(errText(err, 'Your announcement')) }
    setBusy(false)
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this announcement?')) return
    try { await deleteAnnouncement(id); await load() } catch (e) { setError(errText(e, 'The deletion')) }
  }
  return (
    <div className="space-y-4">
      {isTeacher && (
        <form onSubmit={(e) => void post(e)} className={`${card} space-y-2`} noValidate>
          <label htmlFor="ann" className="sr-only">Announcement</label>
          <textarea id="ann" rows={3} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Announce something to your class…" className={inputCls} />
          <button disabled={busy} className={btnPrimary}>Post announcement</button>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
      {items === null ? <Skeleton /> : items.length === 0 ? <Empty>No announcements yet.</Empty> : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-500"><strong className="text-slate-700">{a.author.full_name}</strong> · {fmtDate(a.created_at)}</p>
                {isTeacher && <button onClick={() => void remove(a.id)} aria-label="Delete announcement" className="grid h-9 w-9 place-items-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
