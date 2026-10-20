import { CheckCircle2, Download, FileText, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Empty, ErrorNote, Skeleton } from '../../../components/app/Notes'
import { btnGhost, btnPrimary, card, errText, fmtDate, inputCls, labelCls } from '../../../components/app/ui'
import { addMaterial, deleteMaterial, FILE_ACCEPT, fetchMaterials, MATERIAL_MAX, MATERIAL_TYPES, signedFileUrl, validateFile, type Material } from '../../../lib/classroom'
import { db } from '../../../offline/db'
import { openDownload, removeDownload, saveMaterialOffline } from '../../../offline/downloads'
import { useLive } from '../../../offline/useLive'
import type { TabProps } from './types'

const size = (n: number | null) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function MaterialsTab({ cls, meId, isTeacher }: TabProps) {
  const [items, setItems] = useState<Material[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const saved = useLive(() => db.downloads.where('userId').equals(meId).primaryKeys(), [meId], [] as string[])
  const load = useCallback(async () => { try { setItems(await fetchMaterials(cls.id)) } catch (e) { setItems([]); setError(errText(e, 'Materials')) } }, [cls.id])
  useEffect(() => { void load() }, [load])

  function pick(f: File | undefined) {
    if (!f) return setFile(null)
    const problem = validateFile(f, MATERIAL_TYPES, MATERIAL_MAX)
    if (problem) { setError(problem); setFile(null); return }
    setError(null); setFile(f)
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (!title.trim()) return setError('Give the material a title.')
    setBusy(true)
    try { await addMaterial({ classId: cls.id, userId: meId, title, description: desc, file }); setTitle(''); setDesc(''); setFile(null); await load() } catch (err) { setError(errText(err, 'The material')) }
    setBusy(false)
  }
  async function saveOffline(m: Material) {
    setError(null); setSaving(m.id)
    try { await saveMaterialOffline(meId, cls.id, m) } catch (e) { setError(errText(e, 'The offline copy')) }
    setSaving(null)
  }
  async function unsave(m: Material) { await removeDownload(m.id) }
  async function download(m: Material) {
    if (!m.file_path) return
    try {
      if (saved.includes(m.id)) { await openDownload(m.id); return } window.open(await signedFileUrl('class-files', m.file_path, m.file_name ?? undefined), '_blank', 'noopener') } catch (e) { setError(errText(e, 'The download')) }
  }
  async function remove(m: Material) {
    if (!window.confirm(`Delete "${m.title}"?`)) return
    try { await deleteMaterial(m); await load() } catch (e) { setError(errText(e, 'The deletion')) }
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <form onSubmit={(e) => void add(e)} className={`${card} space-y-3`} noValidate>
          <div><label htmlFor="mt" className={labelCls}>Title</label><input id="mt" className={inputCls} value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label htmlFor="md" className={labelCls}>Description (optional)</label><textarea id="md" rows={2} className={inputCls} value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><label htmlFor="mf" className={labelCls}>File (optional, up to 20 MB)</label><input id="mf" type="file" accept={FILE_ACCEPT} onChange={(e) => pick(e.target.files?.[0])} className="block w-full text-sm" /></div>
          <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add material</button>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
      {items === null ? <Skeleton /> : items.length === 0 ? <Empty>No learning materials yet.</Empty> : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id} className={`${card} flex items-center gap-3`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">{m.title}</p>
                <p className="truncate text-xs text-slate-500">{m.file_name ? `${m.file_name} · ${size(m.file_size)} · ` : ''}{fmtDate(m.created_at)}</p>
                {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
              </div>
              {m.file_path && (saved.includes(m.id)
                ? <button onClick={() => void unsave(m)} className={`${btnGhost} !px-3 text-emerald-700`} aria-label={`Remove offline copy of ${m.title}`}><CheckCircle2 className="h-4 w-4" /><span className="hidden sm:inline">Saved offline</span></button>
                : <button onClick={() => void saveOffline(m)} disabled={saving === m.id} className={`${btnGhost} !px-3`} aria-label={`Save ${m.title} for offline`}>{saving === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">Save offline</span></button>)}
              {m.file_path && <button onClick={() => void download(m)} className={`${btnGhost} !px-3`} aria-label={`Open ${m.title}`}>Open</button>}
              {isTeacher && <button onClick={() => void remove(m)} aria-label={`Delete ${m.title}`} className="grid h-11 w-11 place-items-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
