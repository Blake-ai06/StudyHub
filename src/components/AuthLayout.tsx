import { LogoIcon, Wordmark } from './Logo'
import NodeBackground, { Waves } from './NodeBackground'
import { Link } from 'react-router-dom'

/** Shared navy shell for login / register / reset pages (matches the login reference). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-col items-center overflow-hidden bg-gradient-to-b from-navy-900 to-navy-950">
      <NodeBackground />
      <Waves className="h-40 sm:h-52" />
      <div className="relative z-10 flex w-full flex-1 flex-col items-center px-4 pb-10 pt-10 sm:pt-14">
        <Link to="/" className="flex flex-col items-center" aria-label="StudyHub home">
          <LogoIcon className="h-14 w-14 sm:h-16 sm:w-16" />
          <Wordmark className="mt-3 text-3xl sm:text-4xl" />
        </Link>
        <p className="mt-3 text-[11px] font-medium tracking-[0.3em] text-white/85 sm:text-xs">LEARN • CONNECT • ACHIEVE</p>
        <div className="mt-6 w-full max-w-[440px] rounded-2xl bg-mist p-6 shadow-[0_20px_60px_rgba(0,20,60,0.45)] sm:mt-8 sm:max-w-[520px] sm:p-8 lg:max-w-[480px]">
          {children}
        </div>
      </div>
    </div>
  )
}
