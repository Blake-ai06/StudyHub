import { CheckCircle2, Download, Smartphone, Monitor } from 'lucide-react'
import { useState } from 'react'
import { btnPrimary, card } from './app/ui'
import { promptInstall, useInstall, type Platform } from '../lib/install'

const steps: Record<Platform, { title: string; items: string[] }> = {
  android: {
    title: 'Android phone or tablet (Chrome)',
    items: ['Open this site in Chrome.', 'Tap the ⋮ menu at the top right.', 'Tap “Install app” (some phones say “Add to Home screen”).', 'Tap Install. The StudyHub icon appears on your home screen and in your app list.', 'Samsung Internet: tap the menu, then “Add page to”, then “Home screen”.'],
  },
  ios: {
    title: 'iPhone or iPad (Safari)',
    items: ['Open this site in Safari. (Links opened inside Facebook or Messenger will not offer this.)', 'Tap the Share button (the square with an arrow).', 'Scroll down and tap “Add to Home Screen”.', 'Tap Add. StudyHub now opens from your home screen like an app.'],
  },
  desktop: {
    title: 'Windows, Mac, or Chromebook (Chrome or Edge)',
    items: ['Look at the right end of the address bar for an install icon (a small screen with a down arrow) and click it, then click Install.', 'No icon? Chrome: open the ⋮ menu, then “Cast, save, and share”, then “Install page as app”. Edge: open the ⋯ menu, then Apps, then “Install this site as an app”.', 'StudyHub opens in its own window and appears in your Start menu or Applications folder.', 'Firefox does not support installing web apps.'],
  },
}

/** Shared by the public /install page and the in-app Install page. */
export default function InstallPanel() {
  const { canPrompt, installed, platform } = useInstall()
  const [result, setResult] = useState<'accepted' | 'dismissed' | 'unavailable' | null>(null)
  const order: Platform[] = [platform, ...(['android', 'ios', 'desktop'] as Platform[]).filter((p) => p !== platform)]

  return (
    <div className="space-y-4">
      {installed && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" aria-hidden />StudyHub is installed on this device. Open it from your home screen or app list.</p>
      )}
      {!installed && (
        <section className={`${card} space-y-3`}>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy-900"><Smartphone className="h-5 w-5 text-brand" aria-hidden />Install StudyHub</h2>
          <p className="text-sm text-slate-600">Get it on your home screen or desktop. It opens like a normal app, works offline after your first visit, and uses almost no storage. No app store needed.</p>
          {canPrompt ? (
            <button onClick={() => void promptInstall().then(setResult)} className={btnPrimary}><Download className="h-4 w-4" aria-hidden />Install StudyHub</button>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Your browser did not offer a one-tap install right now. Follow the steps for your device below. They take about 10 seconds.</p>
          )}
          {result === 'accepted' && <p role="status" className="text-sm font-semibold text-emerald-700">Installing. Look for StudyHub on your home screen or app list.</p>}
          {result === 'dismissed' && <p role="status" className="text-sm text-slate-600">No problem. You can install any time from this page.</p>}
        </section>
      )}
      <section className="space-y-2" aria-label="Install steps">
        {order.map((p) => (
          <details key={p} open={p === platform && !installed} className={`${card} !p-0`}>
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-navy-900">{p === 'desktop' ? <Monitor className="h-4 w-4 text-brand" aria-hidden /> : <Smartphone className="h-4 w-4 text-brand" aria-hidden />}{steps[p].title}{p === platform && <span className="ml-auto rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">Your device</span>}</summary>
            <ol className="list-decimal space-y-1 px-9 pb-4 text-sm text-slate-700">{steps[p].items.map((s) => <li key={s}>{s}</li>)}</ol>
          </details>
        ))}
      </section>
      <section className={`${card} space-y-1 text-sm text-slate-600`} aria-label="Install help">
        <h2 className="font-bold text-navy-900">Not working?</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>You closed the install message by accident: that is fine, this page always works.</li>
          <li>Use the real website address (the one with the padlock), not a link opened inside another app. Open it in Chrome or Safari.</li>
          <li>Browse a couple of pages and wait for it to finish loading, then try again.</li>
          <li>To remove it later: on a phone, press and hold the icon and choose Remove or Uninstall. On a computer, open the app, then its ⋮ menu, then Uninstall.</li>
        </ul>
      </section>
    </div>
  )
}
