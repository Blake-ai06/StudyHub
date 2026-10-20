import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cached, setCacheUser } from '../offline/cache'
import { pendingCount, wipeAllLocalData } from '../offline/db'
import { readStoredSession } from '../offline/sessionFallback'
import { AuthContext, type Profile } from './auth-context'
import { supabase } from './supabase'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) return setProfile(null)
    try {
      const data = await cached('profile', async () => {
        const { data, error } = await supabase.from('profiles').select('id, username, full_name, role, avatar_url, bio').eq('id', userId).maybeSingle()
        if (error) throw error
        return data as Profile | null
      })
      if (data) setProfile(data)
    } catch { /* keep whatever profile we already have */ }
  }, [])

  const adopt = useCallback((s: Session | null) => { setCacheUser(s?.user.id ?? null); setSession(s) }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      // Offline start: supabase-js cannot refresh an expired token without a network. Fall back to the stored
      // session just so the device can show cached data. It is never used to authorize anything on the server.
      const s = data.session ?? (!navigator.onLine ? readStoredSession(import.meta.env.VITE_SUPABASE_URL) : null)
      adopt(s)
      await loadProfile(s?.user.id)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      adopt(next)
      setTimeout(() => void loadProfile(next?.user.id), 0) // never call supabase inside the auth callback directly
      if (!next) setProfile(null)
    })
    // Back online after an offline start: pick up the real, refreshed session.
    const onOnline = () => { void supabase.auth.getSession().then(({ data }) => { if (data.session) adopt(data.session) }) }
    window.addEventListener('online', onOnline)
    return () => { active = false; sub.subscription.unsubscribe(); window.removeEventListener('online', onOnline) }
  }, [loadProfile, adopt])

  const value = useMemo(
    () => ({
      session, profile, loading,
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        const uid = session?.user.id
        const n = uid ? await pendingCount(uid).catch(() => 0) : 0
        if (n > 0 && !window.confirm(`You have ${n} change${n === 1 ? '' : 's'} that ${n === 1 ? 'has' : 'have'} not synced yet. Logging out will delete ${n === 1 ? 'it' : 'them'} from this device. Log out anyway?`)) return
        await supabase.auth.signOut()
        await wipeAllLocalData().catch(() => {}) // private cache, drafts, and downloads must not outlive the session
        setCacheUser(null)
      },
    }),
    [session, profile, loading, loadProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
