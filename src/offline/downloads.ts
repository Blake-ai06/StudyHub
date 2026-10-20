import { signedFileUrl, type Material } from '../lib/classroom'
import { db } from './db'

export async function saveMaterialOffline(userId: string, classId: string, m: Material) {
  if (!m.file_path) throw new Error('This material has no file to download.')
  const res = await fetch(await signedFileUrl('class-files', m.file_path))
  if (!res.ok) throw new Error('The file could not be downloaded.')
  const blob = await res.blob()
  await db.downloads.put({ id: m.id, userId, classId, title: m.title, fileName: m.file_name ?? 'file', fileType: m.file_type ?? blob.type, size: blob.size, blob, savedAt: Date.now() })
  void navigator.storage?.persist?.().catch(() => {}) // ask the browser not to evict saved lessons
}
export async function openDownload(id: string) {
  const row = await db.downloads.get(id)
  if (!row) throw new Error('That file is no longer saved on this device.')
  const url = URL.createObjectURL(new Blob([row.blob], { type: row.fileType }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export const removeDownload = (id: string) => db.downloads.delete(id)
export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.()
    const persisted = await navigator.storage?.persisted?.()
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0, persisted: !!persisted } : null
  } catch { return null }
}
export const formatBytes = (n: number) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`)
