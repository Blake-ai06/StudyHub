import { useSyncExternalStore } from 'react'

/** One shared place that remembers the browser's "install this app" offer, so any button on any page can use it later. */
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export type Platform = 'ios' | 'android' | 'desktop'
export interface InstallState { canPrompt: boolean; installed: boolean }

export function detectPlatform(userAgent: string, touchPoints = 0): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && touchPoints > 1)) return 'ios' // iPadOS pretends to be a Mac
  if (/android/i.test(userAgent)) return 'android'
  return 'desktop'
}
export function isStandalone() {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true
}

let deferred: InstallEvent | null = null
let snapshot: InstallState = { canPrompt: false, installed: isStandalone() }
const listeners = new Set<() => void>()
const notify = () => { snapshot = { canPrompt: deferred !== null, installed: snapshot.installed }; listeners.forEach((l) => l()) }
let started = false

/** Call once at startup. The browser fires its install offer early and only once, so it must be caught immediately. */
export function initInstall() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; snapshot = { canPrompt: false, installed: true }; listeners.forEach((l) => l()) })
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => { snapshot = { ...snapshot, installed: e.matches || snapshot.installed }; listeners.forEach((l) => l()) })
  }
}

/** Shows the browser's own install dialog. Returns 'unavailable' when the browser has not offered one (use the written steps instead). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const ev = deferred
  try { await ev.prompt(); const { outcome } = await ev.userChoice; return outcome } finally { deferred = null; notify() } // the offer can only be used once
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export function useInstall() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
  const platform = typeof navigator === 'undefined' ? 'desktop' : detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
  return { ...state, platform }
}
export function __resetInstallForTests() { deferred = null; snapshot = { canPrompt: false, installed: false }; started = false; listeners.clear() }
