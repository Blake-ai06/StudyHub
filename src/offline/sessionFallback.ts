import type { Session } from '@supabase/supabase-js'

export function storedAuthKey(url: string | undefined) {
  try { return `sb-${new URL(url ?? '').hostname.split('.')[0]}-auth-token` } catch { return null }
}
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<Session>
    return s?.user?.id && s.access_token ? (s as Session) : null
  } catch { return null }
}
/** Used only when the device is offline and supabase-js could not refresh an expired token. */
export function readStoredSession(url: string | undefined): Session | null {
  const key = storedAuthKey(url)
  if (!key) return null
  return parseStoredSession(window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key))
}
