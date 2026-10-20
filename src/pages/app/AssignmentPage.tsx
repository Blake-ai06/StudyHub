import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty, ErrorNote, OkNote, Skeleton } from '../../components/app/Notes'
import { btnGhost, btnPrimary, card, errText, fmtDate, inputCls, labelCls } from '../../components/app/ui'
import { useAuth } from '../../lib/auth-context'
import { FILE_ACCEPT, fetchAssignment, fetchMembers, fetchMySubmission, fetchSubmissions, gradeSubmission, signedFileUrl, submissionLabel, SUBMISSION_MAX, SUBMISSION_TYPES, validateFile, type Assignment, type Member, type Submission, type SubmissionWithStudent } from '../../lib/classroom'
import { fetchClass } from '../../lib/classroom'
import { db } from '../../offline/db'
import { clearDraft, getDraft, useDraftSaver } from '../../offline/drafts'
import { runOrQueue } from '../../offline/outbox'
import type { OutboxOp } from '../../offline/types'
import { useLive } from '../../offline/useLive'

export default function AssignmentPage() {
  const { id = '', aid = '' } = useParams()
  const { session, profile } = useAuth()
  const meId = session!.user.id
  const [a, setA] = useState<Assignment | null | undefined>(undefined)
  const [isTeacher, setIsTeacher] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([fetchAssignment(aid), fetchClass(id)]).then(([as, c]) => { setA(as); setIsTeacher(!!c && (c.teacher_id === meId || profile?.role === 'admin')) }).catch(() => { setA(null); setError('This assignment could not load.') })
  }, [aid, id, meId, profile?.role])
  if (a === undefined) return <Skeleton n={3} />
  if (!a) return <div className="space-y-3"><ErrorNote>{error}</ErrorNote><Empty>Assignment not found.</Empty></div>
  return (
    <div className="space-y-4">
      <Link to={`/app/classes/${id}?tab=assignments`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-dark"><ArrowLeft className="h-4 w-4" />Assignments</Link>
      <section className={card}>
        <h1 className="text-xl font-extrabold text-navy-900">{a.title}</h1>
        <p className="text-sm text-slate-500">Due {fmtDate(a.due_at)} · {a.points} points</p>
        {a.instructions && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{a.instructions}</p>}
      </section>
      {isTeacher ? <TeacherView a={a} classId={id} /> : <StudentView a={a} meId={meId} />}
    </div>
  )
}

function StudentView({ a, meId }: { a: Assignment; meId: string }) {
  const [sub, setSub] = useState<Submission | null | undefined>(undefined)
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null)
  const subId = useRef<string>(crypto.randomUUID())
  const saveDraftLater = useDraftSaver(meId, `assignment:${a.id}`)
  const opId = `submission:${a.id}:${meId}` // one slot per assignment: a newer offline save replaces the older one
  const pendingOp = useLive(async () => (await db.outbox.get(opId)) as OutboxOp<'submission.save'> | undefined, [opId], undefined as OutboxOp<'submission.save'> | undefined)

  const load = useCallback(async () => {
    try {
      const s = await fetchMySubmission(a.id, meId)
      setSub(s)
      if (s) subId.current = s.id
      const queued = (await db.outbox.get(opId)) as OutboxOp<'submission.save'> | undefined
      const local = await getDraft(meId, `assignment:${a.id}`)
      if (queued) setBody(queued.payload.body)
      else if (local != null && local !== (s?.body ?? '')) { setBody(local); setRestored(true) }
      else setBody(s?.body ?? '')
    } catch (e) { setSub(null); setError(errText(e, 'Your submission')) }
  }, [a.id, meId, opId])
  useEffect(() => { void load() }, [load])

  function pick(f: File | undefined) {
    if (!f) return setFile(null)
    const problem = validateFile(f, SUBMISSION_TYPES, SUBMISSION_MAX)
    if (problem) { setError(problem); setFile(null); return }
    setError(null); setFile(f)
  }
  async function save(submit: boolean) {
    setError(null); setOk(null)
    if (submit && !body.trim() && !file && !sub?.file_path && !pendingOp?.payload.file) return setError('Add some text or a file before submitting.')
    setBusy(submit ? 'submit' : 'draft')
    try {
      const keep = file ? null : pendingOp?.payload.keepFile ?? (sub?.file_path ? { path: sub.file_path, name: sub.file_name ?? 'file' } : null)
      const carried = !file && pendingOp?.payload.file ? pendingOp.payload : null // a file chosen offline earlier stays attached
      const r = await runOrQueue('submission.save', meId, `Assignment: ${a.title}`, {
        id: subId.current, assignmentId: a.id, studentId: meId, body,
        file: file ?? carried?.file ?? null, fileName: file?.name ?? carried?.fileName, fileType: file?.type ?? carried?.fileType,
        keepFile: keep, submit,
        // The version of the server copy this edit started from (kept from the first offline edit), used to detect conflicts.
        baseUpdatedAt: pendingOp ? pendingOp.payload.baseUpdatedAt : (sub?.updated_at ?? null),
      }, opId)
      setFile(null); setRestored(false); void clearDraft(meId, `assignment:${a.id}`)
      if (r === 'queued') setOk('Saved on this device. The server has NOT received it yet. It will be sent automatically when you are back online.')
      else { await load(); setOk(submit ? 'Submitted. The server has confirmed your work.' : 'Draft saved on the server. It is not submitted yet.') }
    } catch (e) { setError(errText(e, submit ? 'Your submission' : 'Your draft')) }
    setBusy(null)
  }
  async function open(path: string, name: string | null) {
    try { window.open(await signedFileUrl('submission-files', path, name ?? undefined), '_blank', 'noopener') } catch (e) { setError(errText(e, 'The download')) }
  }

  if (sub === undefined) return <Skeleton />
  const graded = sub?.grade != null
  return (
    <section className={`${card} space-y-3`}>
      {pendingOp ? (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${pendingOp.status === 'pending' ? 'bg-sky-50 text-sky-900' : 'bg-amber-50 text-amber-900'}`}>
          {pendingOp.status === 'pending'
            ? `Waiting to sync. Your ${pendingOp.payload.submit ? 'submission' : 'draft'} is saved on this device only. It is not officially ${pendingOp.payload.submit ? 'submitted' : 'saved'} until the server confirms.`
            : <>This change needs your attention. <Link to="/app/offline" className="font-semibold underline">Open Offline &amp; sync</Link></>}
        </p>
      ) : (
        <p className="text-sm"><strong>Status:</strong> {submissionLabel(sub, a)}{sub?.submitted_at && <span className="text-slate-500"> · {fmtDate(sub.submitted_at)}</span>}</p>
      )}
      {graded && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm"><p className="font-bold text-emerald-800">Grade: {sub!.grade}/{a.points}</p>{sub!.feedback && <p className="mt-1 text-emerald-900">Feedback: {sub!.feedback}</p>}</div>
      )}
      {!graded && (
        <>
          {restored && <p role="status" className="text-xs text-slate-500">Restored your unsaved draft from this device.</p>}
          <div><label htmlFor="sb" className={labelCls}>Your answer</label><textarea id="sb" rows={6} maxLength={10000} className={inputCls} value={body} onChange={(e) => { setBody(e.target.value); saveDraftLater(e.target.value) }} /></div>
          <div>
            <label htmlFor="sf" className={labelCls}>Attach a file (optional, up to 10 MB)</label>
            <input id="sf" type="file" accept={FILE_ACCEPT} onChange={(e) => pick(e.target.files?.[0])} className="block w-full text-sm" />
            {pendingOp?.payload.fileName && !file && <p className="mt-2 text-sm text-slate-600">Attached on this device: {pendingOp.payload.fileName}</p>}
            {!pendingOp && sub?.file_path && !file && <button onClick={() => void open(sub.file_path!, sub.file_name)} className="mt-2 text-sm font-semibold text-brand-dark underline">Current file: {sub.file_name}</button>}
          </div>
          <ErrorNote>{error}</ErrorNote><OkNote>{ok}</OkNote>
          <div className="flex flex-wrap gap-2">
            <button disabled={!!busy} onClick={() => void save(false)} className={btnGhost}>{busy === 'draft' && <Loader2 className="h-4 w-4 animate-spin" />}Save draft</button>
            <button disabled={!!busy} onClick={() => void save(true)} className={btnPrimary}>{busy === 'submit' && <Loader2 className="h-4 w-4 animate-spin" />}{sub?.status === 'submitted' ? 'Resubmit' : 'Submit'}</button>
          </div>
        </>
      )}
      {graded && <ErrorNote>{error}</ErrorNote>}
    </section>
  )
}

function TeacherView({ a, classId }: { a: Assignment; classId: string }) {
  const [subs, setSubs] = useState<SubmissionWithStudent[] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const [s, m] = await Promise.all([fetchSubmissions(a.id), fetchMembers(classId)]); setSubs(s); setMembers(m) } catch (e) { setSubs([]); setError(errText(e, 'Submissions')) }
  }, [a.id, classId])
  useEffect(() => { void load() }, [load])
  if (subs === null) return <Skeleton />
  const submitted = subs.filter((s) => s.status === 'submitted')
  const missing = members.filter((m) => !submitted.some((s) => s.student_id === m.user_id))
  return (
    <div className="space-y-3">
      <ErrorNote>{error}</ErrorNote>
      <p className="text-sm text-slate-600">{submitted.length} submitted · {missing.length} not yet submitted</p>
      {submitted.length === 0 ? <Empty>No submissions yet.</Empty> : submitted.map((s) => <GradeRow key={s.id} s={s} a={a} onSaved={load} />)}
      {missing.length > 0 && <p className="text-xs text-slate-500">Waiting on: {missing.map((m) => m.user.full_name).join(', ')}</p>}
    </div>
  )
}

function GradeRow({ s, a, onSaved }: { s: SubmissionWithStudent; a: Assignment; onSaved: () => void }) {
  const [grade, setGrade] = useState(s.grade == null ? '' : String(s.grade))
  const [fb, setFb] = useState(s.feedback ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  async function save() {
    setMsg(null)
    const g = grade.trim() === '' ? null : Number(grade)
    if (g != null && (Number.isNaN(g) || g < 0 || g > a.points)) return setMsg({ ok: false, t: `Enter a grade from 0 to ${a.points}.` })
    setBusy(true)
    try { await gradeSubmission(s.id, g, fb); setMsg({ ok: true, t: 'Saved.' }); onSaved() } catch (e) { setMsg({ ok: false, t: errText(e, 'The grade') }) }
    setBusy(false)
  }
  async function open() {
    try { window.open(await signedFileUrl('submission-files', s.file_path!, s.file_name ?? undefined), '_blank', 'noopener') } catch (e) { setMsg({ ok: false, t: errText(e, 'The download') }) }
  }
  const late = a.due_at && s.submitted_at && new Date(s.submitted_at) > new Date(a.due_at)
  return (
    <article className={`${card} space-y-2`}>
      <header className="flex items-center justify-between gap-2"><h2 className="font-bold text-navy-900">{s.student.full_name}</h2><span className="text-xs text-slate-500">{fmtDate(s.submitted_at)}{late && <span className="ml-1 font-semibold text-red-600">late</span>}</span></header>
      {s.body && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{s.body}</p>}
      {s.file_path && <button onClick={() => void open()} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-dark underline"><Download className="h-4 w-4" />{s.file_name}</button>}
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <div><label htmlFor={`g${s.id}`} className={labelCls}>Grade /{a.points}</label><input id={`g${s.id}`} inputMode="decimal" className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value)} /></div>
        <div><label htmlFor={`f${s.id}`} className={labelCls}>Feedback</label><input id={`f${s.id}`} className={inputCls} value={fb} maxLength={2000} onChange={(e) => setFb(e.target.value)} /></div>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.t}</p>}
      <button disabled={busy} onClick={() => void save()} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save grade</button>
    </article>
  )
}
