import CtaBand from './CtaBand'
import PublicHeader from './PublicHeader'

export default function PageShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-gradient-to-b from-navy-900 to-navy-950 pb-12 text-white">
        <PublicHeader />
        <div className="mx-auto max-w-3xl px-5 pt-6 text-center">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {intro && <p className="mt-3 text-white/85">{intro}</p>}
        </div>
      </div>
      <main className="bg-mist py-12">{children}</main>
      <CtaBand />
    </div>
  )
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-4 px-5 leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy-900 [&_ul]:list-disc [&_ul]:pl-6">{children}</div>
}
