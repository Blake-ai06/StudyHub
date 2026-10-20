import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Empty, ErrorNote, Skeleton } from '../../components/app/Notes'
import { useAuth } from '../../lib/auth-context'
import { fetchClass, type ClassRow } from '../../lib/classroom'
import AssignmentsTab from './class/AssignmentsTab'
import GradesTab from './class/GradesTab'
import MaterialsTab from './class/MaterialsTab'
import PeopleTab from './class/PeopleTab'
import QuizzesTab from './class/QuizzesTab'
import StreamTab from './class/StreamTab'

const tabs = ['stream', 'materials', 'assignments', 'quizzes', 'people', 'grades'] as const
type Tab = (typeof tabs)[number]
const label: Record<Tab, string> = { stream: 'Stream', materials: 'Materials', assignments: 'Assignments', quizzes: 'Quizzes', people: 'People', grades: 'Grades' }

export default function ClassPage() {
  const { id = '' } = useParams()
  const { session, profile } = useAuth()
  const meId = session!.user.id
  const [params, setParams] = useSearchParams()
  const [cls, setCls] = useState<ClassRow | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const tab = (tabs as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'stream'

  useEffect(() => { fetchClass(id).then(setCls).catch(() => { setCls(null); setError('This class could not load.') }) }, [id])

  if (cls === undefined) return <Skeleton n={3} />
  if (!cls) return <div className="space-y-3"><ErrorNote>{error}</ErrorNote><Empty>Class not found, or you are not enrolled in it.</Empty></div>
  const isTeacher = cls.teacher_id === meId || profile?.role === 'admin'
  const props = { cls, meId, isTeacher }

  return (
    <div className="space-y-4">
      <Link to="/app/classes" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-dark"><ArrowLeft className="h-4 w-4" />All classes</Link>
      <header className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-white">
        <h1 className="text-2xl font-extrabold">{cls.name}</h1>
        <p className="text-sm text-white/80">{cls.section ? `${cls.section} · ` : ''}{cls.teacher?.full_name}</p>
        {cls.description && <p className="mt-2 text-sm text-white/90">{cls.description}</p>}
      </header>
      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Class sections">
        <ul className="flex gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <li key={t}><button onClick={() => setParams({ tab: t })} aria-current={tab === t ? 'page' : undefined} className={`min-h-11 whitespace-nowrap px-3 text-sm font-semibold ${tab === t ? 'border-b-2 border-brand text-brand-dark' : 'text-slate-500'}`}>{label[t]}</button></li>
          ))}
        </ul>
      </nav>
      {tab === 'stream' && <StreamTab {...props} />}
      {tab === 'materials' && <MaterialsTab {...props} />}
      {tab === 'assignments' && <AssignmentsTab {...props} />}
      {tab === 'quizzes' && <QuizzesTab {...props} />}
      {tab === 'people' && <PeopleTab {...props} onCodeChange={setCls} />}
      {tab === 'grades' && <GradesTab {...props} />}
    </div>
  )
}
