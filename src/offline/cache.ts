import { db } from './db'
import { isOffline } from './connectivity'

let currentUser: string | null = null
export const setCacheUser = (id: string | null) => { currentUser = id }

export function isNetworkError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? ''
  return (typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|network|load failed|fetch failed|timed? ?out/i.test(msg)
}

/**
 * Read-through cache for the signed-in user. Online: fetch, remember, return fresh data.
 * Offline (or network failure): return the last saved copy if there is one, otherwise throw.
 * Entries are keyed by user id and wiped on log out. Nothing here is trusted for permissions.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const uid = currentUser
  const full = uid ? `${uid}:${key}` : null
  if (full && isOffline()) {
    const row = await db.cache.get(full).catch(() => undefined)
    if (row) return row.data as T
  }
  try {
    const data = await fetcher()
    if (full && uid) void db.cache.put({ key: full, userId: uid, data, updatedAt: Date.now() }).catch(() => {}) // quota errors are not fatal
    return data
  } catch (e) {
    if (full && isNetworkError(e)) {
      const row = await db.cache.get(full).catch(() => undefined)
      if (row) return row.data as T
    }
    throw e
  }
}
