import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { promptInstall, useInstall } from '../lib/install'

const KEY = 'studyhub.installDismissedAt'
const SNOOZE_MS = 7 * 24 * 3600 * 1000
const snoozed = () => { try { const t = Number(localStorage.getItem(KEY)); return t > 0 && Date.now() - t < SNOOZE_MS } catch { return false } }

/** A gentle install reminder. The X only hides it for 7 days; the Install page and menu item are always available. */
export default function InstallToast() {
  const { canPrompt, installed, platform } = useInstall()
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(snoozed)
  if (installed || hidden || (!canPrompt && platform !== 'ios') || pathname.endsWith('/install')) return null
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* private mode: it just comes back next visit */ } setHidden(true) }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-4" aria-live="polite">
      <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-sm text-white shadow-xl">
        <span>Install StudyHub on this device.</span>
        {canPrompt && <button onClick={() => void promptInstall()} className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 font-semibold"><Download className="h-3.5 w-3.5" aria-hidden />Install</button>}
        <Link to={pathname.startsWith('/app') ? '/app/install' : '/install'} className="font-semibold underline">{canPrompt ? 'How?' : 'Show me how'}</Link>
        <button aria-label="Hide the install reminder for a week" onClick={dismiss} className="grid h-8 w-8 place-items-center"><X className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
