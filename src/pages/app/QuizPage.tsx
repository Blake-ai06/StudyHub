import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty, ErrorNote, Skeleton } from '../../components/app/Notes'
import { btnDanger, btnGhost, btnPrimary, card, errText, fmtDate } from '../../components/app/ui'
import { useAuth } from '../../lib/auth-context'
import { db } from '../../offline/db'
import { isOffline, useConnectivity } from '../../offline/connectivity'
import { clearDraft, getDraft, saveDraft } from '../../offline/drafts'
import { runOrQueue } from '../../offline/outbox'
import { useLive } from '../../offline/useLive'
import { deleteQuiz, fetchClass, fetchMyAttempt, fetchQuiz, fetchQuizAttempts, pct, setQuizPublished, submitQuiz, type Attempt, type Quiz, type QuizQuestion } from '../../lib/classroom'

export default function QuizPage() {
  const { id = '', qid = '' } = useParams()
  const { session, profile } = useAuth()
  const meId = session!.user.id
  const [data, setData] = useState<{ quiz: Quiz; questions: QuizQuestion[] } | null | undefined>(undefined)
  const [isTeacher, setIsTeacher] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([fetchQuiz(qid), fetchClass(id)]).then(([d, c]) => { setData(d); setIsTeacher(!!c && (c.teacher_id === meId || profile?.role === 'admin')) }).catch(() => { setData(null); setError('This quiz could not load.') })
  }, [qid, id, meId, profile?.role])
  if (data === undefined) return <Skeleton n={3} />
  if (!data) return <div className="space-y-3"><ErrorNote>{error}</ErrorNote><Empty>Quiz not found, or it is not published.</Empty></div>
  return (
    <div className="space-y-4">
      <Link to={`/app/classes/${id}?tab=quizzes`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-dark"><ArrowLeft className="h-4 w-4" />Quizzes</Link>
      <section className={card}>
        <h1 className="text-xl font-extrabold text-navy-900">{data.quiz.title}</h1>
        <p className="text-sm text-slate-500">Due {fmtDate(data.quiz.due_at)}{data.quiz.time_limit_min ? ` · ${data.quiz.time_limit_min} minute limit` : ''} · {data.questions.length} question{data.questions.length === 1 ? '' : 's'}</p>
        {data.quiz.description && <p className="mt-2 text-sm text-slate-700">{data.quiz.description}</p>}
      </section>
      {isTeacher ? <TeacherQuiz quiz={data.quiz} questions={data.questions} classId={id} /> : <StudentQuiz quiz={data.quiz} questions={data.questions} meId={meId} />}
    </div>
  )
}

interface QuizDraft { answers: Record<string, string>; startedAt: number; attemptId: string }

function StudentQuiz({ quiz, questions, meId }: { quiz: Quiz; questions: QuizQuestion[]; meId: string }) {
  const [attempt, setAttempt] = useState<Attempt | null | undefined>(undefined)
  const [draft, setDraft] = useState<QuizDraft | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)
  const { online } = useConnectivity()
  const draftName = `quiz:${quiz.id}`
  const opId = `quiz:${quiz.id}:${meId}`
  const queuedOp = useLive(() => db.outbox.get(opId), [opId], undefined)

  useEffect(() => {
    fetchMyAttempt(quiz.id, meId).then(setAttempt).catch((e) => { setAttempt(null); setError(errText(e, 'Your attempt')) })
    void getDraft<QuizDraft>(meId, draftName).then((d) => { if (d) setDraft(d) }) // survives refreshes and app restarts
  }, [quiz.id, meId, draftName])

  const answers = draft?.answers ?? {}
  const persist = useCallback((d: QuizDraft) => { setDraft(d); void saveDraft(meId, draftName, d) }, [meId, draftName])

  const submit = useCallback(async () => {
    if (sent.current || !draft) return
    sent.current = true; setBusy(true); setError(null)
    try {
      if (quiz.allow_offline) {
        const r = await runOrQueue('quiz.submit', meId, `Quiz: ${quiz.title}`, { attemptId: draft.attemptId, quizId: quiz.id, studentId: meId, answers: draft.answers }, opId)
        await clearDraft(meId, draftName); setDraft(null)
        if (r === 'sent') setAttempt(await fetchMyAttempt(quiz.id, meId))
      } else {
        if (isOffline()) throw new Error('This quiz needs an internet connection to submit. Reconnect and tap Submit again. Your answers are kept.')
        await submitQuiz(draft.attemptId, quiz.id, draft.answers)
        await clearDraft(meId, draftName); setDraft(null)
        setAttempt(await fetchMyAttempt(quiz.id, meId))
      }
    } catch (e) { sent.current = false; setError(errText(e, 'Your answers')) }
    setBusy(false)
  }, [draft, quiz.allow_offline, quiz.id, quiz.title, meId, opId, draftName])

  // Countdown is derived from the saved start time, so a refresh cannot reset it.
  useEffect(() => {
    if (!draft || !quiz.time_limit_min) return
    const tick = () => setLeft(Math.max(0, Math.ceil((draft.startedAt + quiz.time_limit_min! * 60_000 - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [draft, quiz.time_limit_min])
  useEffect(() => { if (left === 0 && draft && !sent.current) void submit() }, [left, draft, submit])

  if (attempt === undefined) return <Skeleton />
  if (queuedOp) {
    return (
      <section className={`${card} space-y-2`} role="status">
        <p className="font-semibold text-navy-900">{queuedOp.status === 'pending' ? 'Waiting to sync' : 'This attempt needs your attention'}</p>
        <p className="text-sm text-slate-600">{queuedOp.status === 'pending' ? 'Your answers are saved on this device only. They do not count until the server receives them.' : queuedOp.lastError}</p>
        <Link to="/app/offline" className="text-sm font-semibold text-brand-dark underline">Open Offline &amp; sync</Link>
      </section>
    )
  }
  if (attempt) {
    return (
      <section className={`${card} text-center`}>
        <p className="text-sm text-slate-500">Your score</p>
        <p className="text-4xl font-extrabold text-navy-900">{attempt.score}/{attempt.max_score}</p>
        <p className="text-slate-600">{pct(attempt.score, attempt.max_score)}% · submitted {fmtDate(attempt.submitted_at)}</p>
      </section>
    )
  }
  if (!draft) {
    const blocked = !quiz.allow_offline && !online
    return (
      <section className={`${card} space-y-3`}>
        <p className="text-sm text-slate-700">You can take this quiz once.{quiz.time_limit_min ? ` You will have ${quiz.time_limit_min} minutes once you start, and it submits automatically when time runs out.` : ''}</p>
        {quiz.allow_offline
          ? <p className="text-xs text-slate-500">Offline attempts are allowed. If you lose your connection, your answers are saved on this device and sent later. The deadline is checked when the server receives them.</p>
          : <p className="text-xs text-slate-500">This quiz must be submitted while online.</p>}
        {blocked && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">You are offline. Reconnect to start this quiz.</p>}
        <ErrorNote>{error}</ErrorNote>
        <button disabled={blocked} onClick={() => persist({ answers: {}, startedAt: Date.now(), attemptId: crypto.randomUUID() })} className={btnPrimary}>Start quiz</button>
      </section>
    )
  }
  const mm = left == null ? null : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (window.confirm('Submit your answers? You cannot change them afterwards.')) void submit() }} className="space-y-4">
      {mm && <p className="sticky top-14 z-10 rounded-full bg-navy-900 px-4 py-2 text-center text-sm font-bold text-white md:top-2" role="timer" aria-label={`Time left ${mm}`}>Time left {mm}</p>}
      {questions.map((q, i) => (
        <fieldset key={q.id} className={card}>
          <legend className="sr-only">Question {i + 1}</legend>
          <p className="font-semibold text-navy-900">{i + 1}. {q.prompt} <span className="text-xs font-normal text-slate-500">({q.points} pt{q.points === 1 ? '' : 's'})</span></p>
          <div className="mt-2 space-y-2">
            {q.options.map((o) => (
              <label key={o.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${answers[q.id] === o.id ? 'border-brand bg-sky-50' : 'border-slate-200'}`}>
                <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => persist({ ...draft, answers: { ...answers, [q.id]: o.id } })} className="h-4 w-4 accent-brand" />{o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <ErrorNote>{error}</ErrorNote>
      <p className="text-xs text-slate-500">{Object.keys(answers).length} of {questions.length} answered. Your answers are saved on this device as you go.</p>
      <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Submit quiz</button>
    </form>
  )
}

function TeacherQuiz({ quiz, questions, classId }: { quiz: Quiz; questions: QuizQuestion[]; classId: string }) {
  const navigate = useNavigate()
  const [published, setPublished] = useState(quiz.published)
  const [attempts, setAttempts] = useState<Awaited<ReturnType<typeof fetchQuizAttempts>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { fetchQuizAttempts(quiz.id).then(setAttempts).catch((e) => { setAttempts([]); setError(errText(e, 'Results')) }) }, [quiz.id])
  async function toggle() { try { await setQuizPublished(quiz.id, !published); setPublished(!published) } catch (e) { setError(errText(e, 'That change')) } }
  async function remove() {
    if (!window.confirm('Delete this quiz and all attempts?')) return
    try { await deleteQuiz(quiz.id); navigate(`/app/classes/${classId}?tab=quizzes`) } catch (e) { setError(errText(e, 'The deletion')) }
  }
  return (
    <div className="space-y-4">
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2"><button onClick={() => void toggle()} className={btnGhost}>{published ? 'Unpublish' : 'Publish'}</button><button onClick={() => void remove()} className={btnDanger}>Delete quiz</button></div>
      <section className={card}>
        <h2 className="font-bold text-navy-900">Results</h2>
        {attempts === null ? <Skeleton n={1} /> : attempts.length === 0 ? <p className="mt-2 text-sm text-slate-500">No attempts yet.</p> : (
          <ul className="mt-2 divide-y divide-slate-100">{attempts.map((a) => <li key={a.id} className="flex justify-between py-2 text-sm"><span>{a.student.full_name}</span><span className="font-semibold">{a.score}/{a.max_score} ({pct(a.score, a.max_score)}%)</span></li>)}</ul>
        )}
      </section>
      <ol className="space-y-2">{questions.map((q, i) => <li key={q.id} className={card}><p className="font-semibold">{i + 1}. {q.prompt} <span className="text-xs font-normal text-slate-500">({q.points} pts)</span></p><ul className="mt-1 list-disc pl-5 text-sm text-slate-600">{q.options.map((o) => <li key={o.id}>{o.label}</li>)}</ul></li>)}</ol>
    </div>
  )
}
