import { useNavigate } from 'react-router-dom'
import Composer from '../../components/app/Composer'
import { useAuth } from '../../lib/auth-context'

export default function CreatePage() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-navy-900">Create a post</h1>
      {profile && <Composer meId={session!.user.id} name={profile.full_name} avatarUrl={profile.avatar_url} onPosted={() => navigate('/app')} />}
    </div>
  )
}
