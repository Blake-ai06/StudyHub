import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorNote, Skeleton } from '../../../components/app/Notes'
import { btnGhost, btnPrimary, card, errText, fmtDate, inputCls, labelCls, toIso } from '../../../components/app/ui'
import { createQuiz, fetchQuizzes, validateQuizDraft, type Quiz } from '../../../lib/classroom'
import type { TabProps } from './types'

interface QDraft { prompt: string; points: number; options: string[]; correct: number }
const blank = (): QDraft => ({ prompt: '', points: 1, options: ['', '', '', ''], correct: 0 })

export default function QuizzesTab({ cls, meId, isTeacher }: TabProps) {
  const [items, setItems] = useState<Quiz[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState({ title: '', description: '', due: '', limit: '', offline: false, publish: true })
  const [qs, setQs] = useState<QDraft[]>([blank()])

  const load = useCallback(async () => { try { setItems(await fetchQuizzes(cls.id)) } catch (e) { setItems([]); setError(errText(e, 'Quizzes')) } }, [cls.id])
  useEffect(() => { void load() }, [load])

  const patch = (i: number, f: (q: QDraft) => QDraft) => setQs((cur) => cur.map((q, j) => (j === i ? f(q) : q)))

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    const limit = meta.limit ? Number(meta.limit) : null
    if (limit != null && (!Number.isInteger(limit) || limit < 1 || limit > 300)) return setError('Time limit must be 1 to 300 minutes.')
    const draft = { classId: cls.id, userId: meId, title: meta.title, description: meta.description, dueAt: toIso(meta.due), timeLimit: limit, allowOffline: meta.offline, publish: meta.publish, questions: qs }
    const problem = validateQuizDraft(draft)
    if (problem) return setError(problem)
    setBusy(true)
    try { await createQuiz(draft); setOpen(false); setMeta({ title: '', description: '', due: '', limit: '', offline: false, publish: true }); setQs([blank()]); await load() } catch (err) { setError(errText(err, 'The quiz')) }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      {isTeacher && !open && <button onClick={() => setOpen(true)} className={btnPrimary}><Plus className="h-4 w-4" />New quiz</button>}
      {isTeacher && open && (
        <form onSubmit={(e) => void save(e)} className={`${card} space-y-4`} noValidate>
          <div><label htmlFor="qt" className={labelCls}>Quiz title</label><input id="qt" className={inputCls} value={meta.title} maxLength={150} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></div>
          <div><label htmlFor="qd" className={labelCls}>Description (optional)</label><textarea id="qd" rows={2} className={inputCls} value={meta.description} maxLength={1000} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="qdue" className={labelCls}>Deadline (optional)</label><input id="qdue" type="datetime-local" className={inputCls} value={meta.due} onChange={(e) => setMeta({ ...meta, due: e.target.value })} /></div>
            <div><label htmlFor="qlim" className={labelCls}>Time limit, minutes (optional)</label><input id="qlim" inputMode="numeric" className={inputCls} value={meta.limit} onChange={(e) => setMeta({ ...meta, limit: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={meta.offline} onChange={(e) => setMeta({ ...meta, offline: e.target.checked })} />Allow students to take this quiz offline</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={meta.publish} onChange={(e) => setMeta({ ...meta, publish: e.target.checked })} />Publish now (students can see it)</label>

          <ol className="space-y-4">
            {qs.map((q, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1"><label htmlFor={`qp${i}`} className={labelCls}>Question {i + 1}</label><textarea id={`qp${i}`} rows={2} className={inputCls} value={q.prompt} maxLength={1000} onChange={(e) => patch(i, (x) => ({ ...x, prompt: e.target.value }))} /></div>
                  <div className="w-20"><label htmlFor={`qpt${i}`} className={labelCls}>Points</label><input id={`qpt${i}`} inputMode="numeric" className={inputCls} value={q.points} onChange={(e) => patch(i, (x) => ({ ...x, points: Math.min(100, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) }))} /></div>
                  {qs.length > 1 && <button type="button" onClick={() => setQs((c) => c.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`} className="mt-6 grid h-11 w-11 place-items-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <fieldset className="mt-2 space-y-2"><legend className="text-xs font-semibold text-slate-600">Answer choices (select the correct one)</legend>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct${i}`} checked={q.correct === oi} onChange={() => patch(i, (x) => ({ ...x, correct: oi }))} aria-label={`Choice ${oi + 1} is correct`} className="h-5 w-5 accent-brand" />
                      <input aria-label={`Question ${i + 1} choice ${oi + 1}`} className={inputCls} value={o} maxLength={300} placeholder={`Choice ${oi + 1}`} onChange={(e) => patch(i, (x) => ({ ...x, options: x.options.map((y, k) => (k === oi ? e.target.value : y)) }))} />
                    </div>
                  ))}
                </fieldset>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setQs((c) => [...c, blank()])} className={btnGhost}><Plus className="h-4 w-4" />Add question</button>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-2">
            <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save quiz</button>
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
          </div>
        </form>
      )}
      {!open && <ErrorNote>{error}</ErrorNote>}
      {items === null ? <Skeleton /> : items.length === 0 ? <Empty>No quizzes yet.</Empty> : (
        <ul className="space-y-3">
          {items.map((q) => (
            <li key={q.id}>
              <Link to={`/app/classes/${cls.id}/quizzes/${q.id}`} className={`${card} flex items-center justify-between gap-3 hover:border-brand/50`}>
                <span className="min-w-0"><span className="block truncate font-semibold text-navy-900">{q.title}</span><span className="text-xs text-slate-500">Due {fmtDate(q.due_at)}{q.time_limit_min ? ` · ${q.time_limit_min} min` : ''}</span></span>
                {isTeacher && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${q.published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{q.published ? 'Published' : 'Draft'}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
