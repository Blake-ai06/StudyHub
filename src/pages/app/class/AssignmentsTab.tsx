import { Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorNote, Skeleton } from '../../../components/app/Notes'
import { btnPrimary, card, errText, fmtDate, inputCls, labelCls, toIso } from '../../../components/app/ui'
import { createAssignment, deleteAssignment, fetchAssignments, fetchMyGrades, submissionLabel, type Assignment, type Submission } from '../../../lib/classroom'
import type { TabProps } from './types'

export default function AssignmentsTab({ cls, meId, isTeacher }: TabProps) {
  const [items, setItems] = useState<Assignment[] | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ title: '', instructions: '', due: '', points: '100' })

  const load = useCallback(async () => {
    try {
      if (isTeacher) setItems(await fetchAssignments(cls.id))
      else { const g = await fetchMyGrades(cls.id, meId); setItems(g.assignments); setSubs(g.subs) }
    } catch (e) { setItems([]); setError(errText(e, 'Assignments')) }
  }, [cls.id, meId, isTeacher])
  useEffect(() => { void load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    const points = Number(f.points)
    if (!f.title.trim()) return setError('Give the assignment a title.')
    if (!Number.isInteger(points) || points < 1 || points > 1000) return setError('Points must be a whole number from 1 to 1000.')
    setBusy(true)
    try { await createAssignment({ classId: cls.id, userId: meId, title: f.title, instructions: f.instructions, dueAt: toIso(f.due), points }); setF({ title: '', instructions: '', due: '', points: '100' }); await load() } catch (err) { setError(errText(err, 'The assignment')) }
    setBusy(false)
  }
  async function remove(a: Assignment) {
    if (!window.confirm(`Delete "${a.title}" and all its submissions?`)) return
    try { await deleteAssignment(a.id); await load() } catch (e) { setError(errText(e, 'The deletion')) }
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <form onSubmit={(e) => void create(e)} className={`${card} space-y-3`} noValidate>
          <div><label htmlFor="at" className={labelCls}>Title</label><input id="at" className={inputCls} value={f.title} maxLength={150} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label htmlFor="ai" className={labelCls}>Instructions (optional)</label><textarea id="ai" rows={3} className={inputCls} value={f.instructions} maxLength={4000} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="ad" className={labelCls}>Due date (optional)</label><input id="ad" type="datetime-local" className={inputCls} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
            <div><label htmlFor="ap" className={labelCls}>Points</label><input id="ap" inputMode="numeric" className={inputCls} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} /></div>
          </div>
          <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create assignment</button>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
      {items === null ? <Skeleton /> : items.length === 0 ? <Empty>No assignments yet.</Empty> : (
        <ul className="space-y-3">
          {items.map((a) => {
            const mine = subs.find((s) => s.assignment_id === a.id) ?? null
            const status = isTeacher ? null : submissionLabel(mine, a)
            return (
              <li key={a.id} className={`${card} flex items-center gap-3`}>
                <Link to={`/app/classes/${cls.id}/assignments/${a.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-900">{a.title}</p>
                  <p className="text-xs text-slate-500">Due {fmtDate(a.due_at)} · {a.points} pts</p>
                </Link>
                {status && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'Graded' ? 'bg-emerald-100 text-emerald-700' : status.startsWith('Submitted') ? 'bg-sky-100 text-sky-700' : status === 'Missing' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{status}</span>}
                {isTeacher && <button onClick={() => void remove(a)} aria-label={`Delete ${a.title}`} className="grid h-11 w-11 place-items-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
