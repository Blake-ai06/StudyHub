export default function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  const style = { width: size, height: size, fontSize: size * 0.38 }
  return url ? (
    <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={style} aria-hidden className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-light to-brand-dark font-bold text-white">{initials || '?'}</span>
  )
}
