export const card = 'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_6px_20px_rgba(15,60,130,0.06)]'
export const btnPrimary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60'
export const btnGhost = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60'
export const btnDanger = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60'
export const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-3 text-sm focus:border-brand focus:bg-white focus:outline-none'
export const labelCls = 'mb-1 block text-xs font-semibold text-slate-600'

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date')
export const toIso = (local: string) => (local ? new Date(local).toISOString() : null)
export const errText = (e: unknown, what: string) =>
  !navigator.onLine || /fetch|network/i.test((e as Error)?.message ?? '')
    ? `You are offline. ${what} was not saved.`
    : ((e as Error)?.message || `${what} could not be saved.`)
