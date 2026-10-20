import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors min-h-11'

export function PrimaryLink({ to, children, arrow = false, className = '' }: { to: string; children: React.ReactNode; arrow?: boolean; className?: string }) {
  return (
    <Link to={to} className={`${base} bg-brand px-6 py-3 text-white shadow-[0_8px_24px_rgba(10,150,255,0.35)] hover:bg-brand-light ${className}`}>
      {children}
      {arrow && <ArrowRight className="h-4 w-4" aria-hidden />}
    </Link>
  )
}

export function OutlineLink({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${base} border border-white/80 px-6 py-3 text-white hover:bg-white/10 ${className}`}>
      {children}
    </Link>
  )
}
