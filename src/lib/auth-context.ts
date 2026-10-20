import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type Role = 'student' | 'teacher' | 'admin'
export interface Profile {
  id: string
  username: string
  full_name: string
  role: Role
  avatar_url: string | null
  bio: string | null
}
export interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
})
export const useAuth = () => useContext(AuthContext)
