import { Link } from 'react-router-dom'
import { OutlineLink, PrimaryLink } from './Buttons'
import { Waves } from './NodeBackground'

export default function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-navy-800 text-white">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden>
        <path d="M-50 300 C 120 180, 260 150, 420 230 S 600 330, 700 300 L-50 300 Z" fill="#0a4a9e" opacity="0.35" />
        <path d="M1000 300 C 1150 170, 1300 120, 1500 200 L1500 300 Z" fill="#0a4a9e" opacity="0.35" />
      </svg>
      <Waves className="h-20 opacity-60" />
      <div className="relative mx-auto max-w-3xl px-5 py-12 text-center sm:py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">Ready to be part of the study circle?</h2>
        <p className="mt-2 text-sm text-white/85 sm:text-base">Join StudyHub today and make your study life easier, smarter, and more connected.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <PrimaryLink to="/register" arrow>Get Started</PrimaryLink>
          <OutlineLink to="/login">Log In</OutlineLink>
        </div>
        <p className="mt-10 flex justify-center gap-5 text-xs text-white/70">
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <Link to="/install" className="hover:text-white">Get the app</Link>
        </p>
      </div>
    </section>
  )
}
