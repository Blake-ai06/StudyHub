import { useSyncExternalStore } from 'react'

/**
 * navigator.onLine only says the device has a network interface, not that our server is reachable.
 * "online" here means: the browser says online AND a real request to Supabase got an HTTP response.
 */
interface State { online: boolean; checking: boolean; checkedAt: number }
let state: State = { online: typeof navigator === 'undefined' ? true : navigator.onLine, checking: false, checkedAt: 0 }
const listeners = new Set<() => void>()
function set(next: Partial<State>) {
  const merged = { ...state, ...next }
  if (merged.online === state.online && merged.checking === state.checking) { state = merged; return }
  state = merged
  listeners.forEach((l) => l())
}
export const subscribeConnectivity = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getConnectivity = () => state
export const isOffline = () => !state.online

export async function pingServer(fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!base) return true // nothing to ping; trust the browser
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    // Any HTTP response (even 401/404) proves the server is reachable. Only a network failure means "offline".
    await fetchImpl(`${base}/auth/v1/health`, { method: 'GET', headers: key ? { apikey: key } : undefined, cache: 'no-store', signal: ctl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function checkReachability(fetchImpl?: typeof fetch) {
  set({ checking: true })
  const ok = await pingServer(fetchImpl)
  set({ online: ok, checking: false, checkedAt: Date.now() })
  return ok
}

let started = 0
let stop: (() => void) | null = null
export function startConnectivity() {
  started += 1
  if (started === 1) {
    const onOffline = () => set({ online: false })
    const onOnline = () => { void checkReachability() }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void checkReachability() }, 20000)
    stop = () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); clearInterval(iv) }
  }
  return () => { started -= 1; if (started === 0) { stop?.(); stop = null } }
}
export function useConnectivity() {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, getConnectivity)
}
export function __setConnectivityForTests(online: boolean) { set({ online }) }
