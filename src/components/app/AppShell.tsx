import { Bell, Bookmark, CloudOff, Download, GraduationCap, Home, LogOut, MessageSquare, PlusCircle, Search, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context'
import { useInstall } from '../../lib/install'
import { unreadCount } from '../../lib/social'
import { LogoIcon, Wordmark } from '../Logo'
import Avatar from './Avatar'
import SyncStatus, { SyncController } from './SyncStatus'

const main = [
  { to: '/app', label: 'Home', Icon: Home, end: true },
  { to: '/app/classes', label: 'Classes', Icon: GraduationCap },
  { to: '/app/create', label: 'Create', Icon: PlusCircle },
  { to: '/app/messages', label: 'Messages', Icon: MessageSquare },
  { to: '/app/me', label: 'Profile', Icon: User },
]
const extra = [
  { to: '/app/people', label: 'People', Icon: Users },
  { to: '/app/notifications', label: 'Notifications', Icon: Bell },
  { to: '/app/bookmarks', label: 'Bookmarks', Icon: Bookmark },
  { to: '/app/offline', label: 'Offline & sync', Icon: CloudOff },
]

export default function AppShell() {
  const { profile, signOut, session } = useAuth()
  const uid = session!.user.id
  const { installed } = useInstall()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  useEffect(() => { void unreadCount().then(setUnread).catch(() => {}) }, [location.pathname])

  const side = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isActive ? 'bg-brand/10 text-brand-dark' : 'text-slate-600 hover:bg-slate-100'}`
  const bottom = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-brand-dark' : 'text-slate-500'}`

  return (
    <div className="min-h-screen bg-mist">
      <SyncController userId={uid} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-slate-200 bg-white p-2 md:flex lg:w-64 lg:p-4">
        <Link to="/app" className="flex items-center gap-3 px-1 py-2" aria-label="StudyHub home"><LogoIcon className="h-10 w-10" /><span className="hidden lg:inline"><Wordmark dark className="text-xl" /></span></Link>
        <nav className="mt-4 flex flex-1 flex-col gap-1" aria-label="Main">
          {[...main, ...extra, ...(installed ? [] : [{ to: '/app/install', label: 'Install app', Icon: Download }])].map(({ to, label, Icon, ...r }) => (
            <NavLink key={to} to={to} end={'end' in r} className={side} aria-label={label}>
              <span className="relative"><Icon className="h-5 w-5" aria-hidden />{label === 'Notifications' && unread > 0 && <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500" />}</span>
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        {profile && (
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={36} />
            <div className="hidden min-w-0 flex-1 lg:block"><p className="truncate text-sm font-semibold text-navy-900">{profile.full_name}</p><p className="truncate text-xs capitalize text-slate-500">{profile.role}</p></div>
            <button onClick={() => void signOut()} aria-label="Log out" className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><LogOut className="h-4 w-4" /></button>
          </div>
        )}
      </aside>

      <div className="md:pl-16 lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white md:hidden">
          <Link to="/app" className="flex items-center gap-2" aria-label="StudyHub home"><LogoIcon className="h-8 w-8" /><Wordmark className="text-lg" /></Link>
          <div className="flex items-center gap-1">
            <SyncStatus userId={uid} compact />
            <Link to="/app/people" aria-label="Find people" className="grid h-11 w-11 place-items-center"><Search className="h-5 w-5" /></Link>
            <Link to="/app/notifications" aria-label="Notifications" className="relative grid h-11 w-11 place-items-center"><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-rose-500" />}</Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-28 md:pb-10">
          <div className="mb-3 hidden justify-end md:flex"><SyncStatus userId={uid} /></div>
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        {main.map(({ to, label, Icon, ...r }) => (
          <NavLink key={to} to={to} end={'end' in r} className={bottom}><Icon className={label === 'Create' ? 'h-7 w-7 text-brand' : 'h-5 w-5'} aria-hidden />{label}</NavLink>
        ))}
      </nav>
    </div>
  )
}
