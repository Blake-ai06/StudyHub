import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorNote, Skeleton } from '../../../components/app/Notes'
import { card, errText } from '../../../components/app/ui'
import { fetchGradebook, fetchMyGrades, pct, submissionLabel, summarize } from '../../../lib/classroom'
import type { TabProps } from './types'

type Mine = Awaited<ReturnType<typeof fetchMyGrades>>
type Book = Awaited<ReturnType<typeof fetchGradebook>>

export default function GradesTab({ cls, meId, isTeacher }: TabProps) {
  const [mine, setMine] = useState<Mine | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const p = isTeacher ? fetchGradebook(cls.id).then(setBook) : fetchMyGrades(cls.id, meId).then(setMine)
    p.catch((e) => setError(errText(e, 'Grades')))
  }, [cls.id, meId, isTeacher])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (isTeacher) {
    if (!book) return <Skeleton />
    if (book.members.length === 0) return <Empty>No students yet.</Empty>
    return (
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Student</th><th>Assignments</th><th>Quizzes</th><th>Overall</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {book.members.map((m) => {
              const s = summarize({ assignments: book.assignments, quizzes: book.quizzes, subs: book.subs.filter((x) => x.student_id === m.user_id), attempts: book.attempts.filter((x) => x.student_id === m.user_id) })
              const subm = book.subs.filter((x) => x.student_id === m.user_id && x.status === 'submitted').length
              const quz = book.attempts.filter((x) => x.student_id === m.user_id).length
              return (
                <tr key={m.user_id}>
                  <td className="py-2.5 font-semibold text-navy-900">{m.user.full_name}</td>
                  <td>{subm}/{book.assignments.length} submitted</td>
                  <td>{quz}/{book.quizzes.filter((q) => q.published).length} taken</td>
                  <td>{s.percent == null ? '—' : `${s.percent}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }
  if (!mine) return <Skeleton />
  const s = summarize(mine)
  return (
    <div className="space-y-4">
      <section className={card} aria-label="Progress">
        <p className="text-sm text-slate-500">Overall grade</p>
        <p className="text-3xl font-extrabold text-navy-900">{s.percent == null ? 'Not graded yet' : `${s.percent}%`}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={s.total ? Math.round((s.done / s.total) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Work completed">
          <div className="h-full bg-brand" style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{s.done} of {s.total} items completed</p>
      </section>
      {mine.assignments.length + mine.quizzes.length === 0 ? <Empty>Nothing to grade yet.</Empty> : (
        <ul className="space-y-2">
          {mine.assignments.map((a) => {
            const sub = mine.subs.find((x) => x.assignment_id === a.id) ?? null
            return (
              <li key={a.id} className={card}>
                <Link to={`/app/classes/${cls.id}/assignments/${a.id}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0"><span className="block truncate font-semibold text-navy-900">{a.title}</span><span className="text-xs text-slate-500">{submissionLabel(sub, a)}</span></span>
                  <span className="shrink-0 font-bold text-navy-900">{sub?.grade != null ? `${sub.grade}/${a.points}` : '—'}</span>
                </Link>
                {sub?.feedback && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">Feedback: {sub.feedback}</p>}
              </li>
            )
          })}
          {mine.quizzes.filter((q) => q.published).map((q) => {
            const t = mine.attempts.find((x) => x.quiz_id === q.id)
            return (
              <li key={q.id} className={card}>
                <Link to={`/app/classes/${cls.id}/quizzes/${q.id}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0"><span className="block truncate font-semibold text-navy-900">{q.title}</span><span className="text-xs text-slate-500">Quiz · {t ? 'Taken' : 'Not taken'}</span></span>
                  <span className="shrink-0 font-bold text-navy-900">{t ? `${t.score}/${t.max_score} (${pct(t.score, t.max_score)}%)` : '—'}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
