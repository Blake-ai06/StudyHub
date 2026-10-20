import { CloudOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Wordmark, LogoIcon } from '../components/Logo'

/** Shown at /offline. The service worker serves the app shell offline, and the app falls back here when a page cannot be loaded. */
export default function OfflineFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-navy-900 to-navy-950 px-5 text-center text-white">
      <div className="max-w-md">
        <div className="mx-auto flex w-fit items-center gap-3"><LogoIcon className="h-12 w-12" /><Wordmark className="text-3xl" /></div>
        <CloudOff className="mx-auto mt-8 h-10 w-10 text-brand-light" aria-hidden />
        <h1 className="mt-3 text-2xl font-extrabold">You are offline</h1>
        <p className="mt-2 text-white/85">This page needs the internet. Anything you already saved on this device still works: downloaded lessons, drafts, and pages you opened before.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-brand px-6 font-semibold">Try again</button>
          <Link to="/app/offline" className="inline-flex min-h-11 items-center rounded-full border border-white/80 px-6 font-semibold">My offline files</Link>
        </div>
      </div>
    </main>
  )
}
