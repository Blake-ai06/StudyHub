import { GraduationCap } from 'lucide-react'

export function LogoIcon({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-gradient-to-br from-[#22b0ff] to-[#0a8cff] shadow-[0_0_24px_rgba(10,150,255,0.45)] ${className}`}>
      <GraduationCap className="h-[58%] w-[58%] text-white" strokeWidth={2} aria-hidden />
    </span>
  )
}

export function Wordmark({ className = 'text-2xl', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className={dark ? 'text-navy-900' : 'text-white'}>STUDY</span>
      <span className="text-brand">HUB</span>
    </span>
  )
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="StudyHub">
      <LogoIcon className="h-10 w-10 sm:h-11 sm:w-11" />
      <Wordmark className="text-xl sm:text-2xl" />
    </span>
  )
}
