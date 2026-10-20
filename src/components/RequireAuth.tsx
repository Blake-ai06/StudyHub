import { Loader2 } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type Role } from '../lib/auth-context'

export default function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-900 text-white" role="status" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Role checks here are only for navigation. The database (RLS) is what actually enforces access.
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/app" replace />
  return <>{children}</>
}
