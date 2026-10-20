import { CalendarCheck, FileText, MonitorPlay, Users } from 'lucide-react'

const featureCards = [
  { title: 'Study Groups', text: 'Find or create study groups and collaborate with classmates in real time.', Icon: Users, tone: 'bg-sky-100 text-sky-600' },
  { title: 'Shared Notes', text: 'Access and share notes, resources, and study materials anytime, anywhere.', Icon: FileText, tone: 'bg-violet-100 text-violet-700' },
  { title: 'Deadlines & Reminders', text: 'Keep track of your tasks, assignments, and exams with smart reminders.', Icon: CalendarCheck, tone: 'bg-emerald-100 text-emerald-700' },
  { title: 'Study Rooms', text: 'Join or create virtual study rooms and focus together, no matter where you are.', Icon: MonitorPlay, tone: 'bg-blue-100 text-blue-600' },
]

export function FeatureGrid() {
  return (
    <ul className="mx-auto grid max-w-7xl gap-4 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:px-8">
      {featureCards.map(({ title, text, Icon, tone }) => (
        <li key={title} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_6px_20px_rgba(15,60,130,0.06)]">
          <span className={`grid h-14 w-14 place-items-center rounded-full ${tone}`}><Icon className="h-6 w-6" aria-hidden /></span>
          <h3 className="mt-3 text-lg font-bold text-navy-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{text}</p>
        </li>
      ))}
    </ul>
  )
}

