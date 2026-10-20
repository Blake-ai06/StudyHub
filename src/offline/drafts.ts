import { useCallback, useRef } from 'react'
import { db } from './db'

const k = (uid: string, name: string) => `${uid}:${name}`
const isEmpty = (v: unknown) => v == null || v === '' || (typeof v === 'object' && Object.keys(v as object).length === 0)

export async function getDraft<T = string>(uid: string, name: string): Promise<T | null> {
  try { return ((await db.drafts.get(k(uid, name)))?.value as T | undefined) ?? null } catch { return null }
}
export async function saveDraft(uid: string, name: string, value: unknown) {
  try {
    if (isEmpty(value)) await db.drafts.delete(k(uid, name))
    else await db.drafts.put({ key: k(uid, name), userId: uid, value, updatedAt: Date.now() })
  } catch { /* storage full or blocked: the draft just will not persist */ }
}
export const clearDraft = (uid: string, name: string) => saveDraft(uid, name, null)

/** Debounced draft writer so typing is saved locally without hammering IndexedDB. */
export function useDraftSaver(uid: string, name: string, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  return useCallback((value: unknown) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { void saveDraft(uid, name, value) }, delay)
  }, [uid, name, delay])
}
