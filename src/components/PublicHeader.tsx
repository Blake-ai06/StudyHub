import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from './Logo'
import { OutlineLink, PrimaryLink } from './Buttons'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/features', label: 'Features' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function PublicHeader() {
  const [open, setOpen] = useState(false)
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative py-2 text-sm font-medium text-white/90 hover:text-white ${isActive ? 'text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded after:bg-brand' : ''}`

  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <NavLink to="/" aria-label="StudyHub home"><Logo /></NavLink>

        <nav className="hidden items-center gap-10 md:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <OutlineLink to="/login" className="!px-5 !py-2.5 text-sm">Log In</OutlineLink>
          <PrimaryLink to="/register" className="!px-5 !py-2.5 text-sm">Get Started</PrimaryLink>
        </div>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-lg text-white md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="mx-4 rounded-2xl border border-white/10 bg-navy-800/95 p-4 backdrop-blur md:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-white/90 hover:bg-white/10">
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <OutlineLink to="/login">Log In</OutlineLink>
            <PrimaryLink to="/register">Get Started</PrimaryLink>
          </div>
        </div>
      )}
    </header>
  )
}
