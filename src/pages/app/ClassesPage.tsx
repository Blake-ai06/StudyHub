import { CalendarClock, Loader2, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, ErrorNote, Skeleton } from '../../components/app/Notes'
import { btnGhost, btnPrimary, card, errText, fmtDate, inputCls, labelCls } from '../../components/app/ui'
import { useAuth } from '../../lib/auth-context'
import { createClass, fetchMyClasses, fetchTeacherStats, fetchUpcoming, isTeacherRole, joinClass, type ClassRow, type Deadline, type TeacherStat } from '../../lib/classroom'

export default function ClassesPage() {
  const { session, profile } = useAuth()
  const meId = session!.user.id
  const teacher = isTeacherRole(profile?.role)
  const navigate = useNavigate()
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [stats, setStats] = useState<TeacherStat[]>([])
  const [upcoming, setUpcoming] = useState<Deadline[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [form, setForm] = useState({ name: '', section: '', description: '' })

  const load = useCallback(async () => {
    try {
      const c = await fetchMyClasses(); setClasses(c); setError(null)
      const mine = c.filter((x) => x.teacher_id === meId), joined = c.filter((x) => x.teacher_id !== meId)
      const [s, u] = await Promise.all([fetchTeacherStats(mine), fetchUpcoming(meId, joined)])
      setStats(s); setUpcoming(u)
    } catch (e) { setClasses([]); setError(errText(e, 'Your classes')) }
  }, [meId])
  useEffect(() => { void load() }, [load])

  async function onJoin(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (code.trim().length < 4) return setError('Enter the class code your teacher gave you.')
    setBusy(true)
    try {
      const id = await joinClass(code)
      if (!id) setError('That code is not valid, or the class is not accepting new students.')
      else navigate(`/app/classes/${id}`)
    } catch (err) { setError(errText(err, 'Joining')) }
    setBusy(false)
  }
  async function onCreate(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (form.name.trim().length < 2) return setError('Give the class a name (at least 2 characters).')
    setBusy(true)
    try { const id = await createClass({ teacherId: meId, ...form }); navigate(`/app/classes/${id}`) } catch (err) { setError(errText(err, 'The class')) }
    setBusy(false)
  }

  const mine = (classes ?? []).filter((c) => c.teacher_id === meId)
  const joined = (classes ?? []).filter((c) => c.teacher_id !== meId)
  const grid = (list: ClassRow[], isMine: boolean) => (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((c) => {
        const st = stats.find((s) => s.classId === c.id)
        return (
          <li key={c.id}>
            <Link to={`/app/classes/${c.id}`} className={`${card} block h-full hover:border-brand/50`}>
              <div className="h-1.5 w-12 rounded bg-gradient-to-r from-brand to-brand-light" />
              <h3 className="mt-3 font-bold text-navy-900">{c.name}</h3>
              <p className="text-xs text-slate-500">{c.section ? `${c.section} · ` : ''}{isMine ? 'You teach this class' : (c.teacher?.full_name ?? 'Teacher')}</p>
              {isMine && st && <p className="mt-3 text-sm text-slate-600">{st.students} student{st.students === 1 ? '' : 's'}{st.toGrade > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{st.toGrade} to grade</span>}</p>}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-navy-900">Classes</h1>
        {teacher && <button onClick={() => setShowNew((v) => !v)} className={btnPrimary}><Plus className="h-4 w-4" />New class</button>}
      </div>
      <ErrorNote>{error}</ErrorNote>

      {teacher && showNew && (
        <form onSubmit={(e) => void onCreate(e)} className={`${card} space-y-3`} noValidate>
          <div><label htmlFor="cn" className={labelCls}>Class name</label><input id="cn" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
          <div><label htmlFor="cs" className={labelCls}>Section (optional)</label><input id="cs" className={inputCls} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} maxLength={50} /></div>
          <div><label htmlFor="cd" className={labelCls}>Description (optional)</label><textarea id="cd" rows={2} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} /></div>
          <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create class</button>
        </form>
      )}

      {!teacher && (
        <form onSubmit={(e) => void onJoin(e)} className={`${card} flex flex-wrap items-end gap-3`} noValidate>
          <div className="min-w-0 flex-1"><label htmlFor="jc" className={labelCls}>Join a class with a code</label><input id="jc" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7F3A9C21" autoCapitalize="characters" className={`${inputCls} font-mono tracking-widest`} maxLength={12} /></div>
          <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Join</button>
        </form>
      )}

      {upcoming.length > 0 && (
        <section aria-label="Upcoming deadlines" className={card}>
          <h2 className="flex items-center gap-2 font-bold text-navy-900"><CalendarClock className="h-5 w-5 text-brand" />Upcoming deadlines</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {upcoming.map((d) => (
              <li key={`${d.kind}-${d.id}`}>
                <Link to={`/app/classes/${d.classId}/${d.kind === 'quiz' ? 'quizzes' : 'assignments'}/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{d.title}</span><span className="text-xs text-slate-500">{d.className} · {d.kind}</span></span>
                  <span className={`shrink-0 text-xs font-semibold ${new Date(d.dueAt) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>{fmtDate(d.dueAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {classes === null ? <Skeleton /> : (
        <>
          {mine.length > 0 && <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Teaching</h2>{grid(mine, true)}</section>}
          {joined.length > 0 && <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Enrolled</h2>{grid(joined, false)}</section>}
          {classes.length === 0 && <Empty>{teacher ? 'You have not created a class yet. Tap New class to start.' : 'You are not in any class yet. Enter a code from your teacher above.'}</Empty>}
        </>
      )}
      {!teacher && <p className="text-center"><button onClick={() => void load()} className={btnGhost}>Refresh</button></p>}
    </div>
  )
}
