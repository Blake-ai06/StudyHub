import { Link } from 'react-router-dom'
import { LogoIcon, Wordmark } from '../components/Logo'

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-navy-900 to-navy-950 px-5 text-center text-white">
      <div className="max-w-md">
        <div className="mx-auto flex w-fit items-center gap-3"><LogoIcon className="h-12 w-12" /><Wordmark className="text-3xl" /></div>
        <p className="mt-8 text-6xl font-extrabold text-brand">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">Page not found</h1>
        <p className="mt-2 text-white/85">That page does not exist, or the link is out of date.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold">Back to home</Link>
          <Link to="/app" className="inline-flex min-h-11 items-center rounded-full border border-white/80 px-6 font-semibold">Open the app</Link>
        </div>
      </div>
    </main>
  )
}
