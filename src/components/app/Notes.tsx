export function ErrorNote({ children }: { children: React.ReactNode }) {
  return children ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p> : null
}
export function OkNote({ children }: { children: React.ReactNode }) {
  return children ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{children}</p> : null
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</p>
}
export function Skeleton({ n = 2 }: { n?: number }) {
  return <div className="space-y-3" aria-label="Loading">{Array.from({ length: n }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
}
