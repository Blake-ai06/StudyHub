import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

/** Shown to visitors whenever a feature needs the database but the site was built without its Supabase settings. */
export const NOT_CONNECTED_MESSAGE =
  'This site is not connected to its database yet. The site owner needs to set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY and redeploy.'
if (!isSupabaseConfigured) {
  console.error('StudyHub: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY are missing from this build. Local: check .env.local and restart `npm run dev`. Vercel/Netlify: add both variables, then redeploy.')
}

export const REMEMBER_KEY = 'studyhub.remember'

/**
 * "Remember me": checked → session persists in localStorage (survives restarts).
 * Unchecked → session lives in sessionStorage (cleared when the browser tab/window closes).
 */
export const sessionStorageAdapter = {
  getItem: (k: string) => window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k),
  setItem: (k: string, v: string) => {
    const remember = window.localStorage.getItem(REMEMBER_KEY) !== '0'
    const [keep, drop] = remember ? [window.localStorage, window.sessionStorage] : [window.sessionStorage, window.localStorage]
    keep.setItem(k, v)
    drop.removeItem(k)
  },
  removeItem: (k: string) => {
    window.localStorage.removeItem(k)
    window.sessionStorage.removeItem(k)
  },
}

export function setRememberMe(remember: boolean) {
  window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
}

// Publishable key only. Never put a secret / service_role key in frontend code.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sessionStorageAdapter },
})

// Social login is only offered when the provider is really configured in Supabase.
export const oauthEnabled = {
  google: import.meta.env.VITE_OAUTH_GOOGLE === 'true',
  facebook: import.meta.env.VITE_OAUTH_FACEBOOK === 'true',
}
