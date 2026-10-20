import { Copy, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../../components/app/Avatar'
import { Empty, ErrorNote, OkNote, Skeleton } from '../../../components/app/Notes'
import { btnDanger, btnGhost, card, errText } from '../../../components/app/ui'
import { fetchMembers, regenerateCode, removeMember, setJoinEnabled, type ClassRow, type Member } from '../../../lib/classroom'
import type { TabProps } from './types'

export default function PeopleTab({ cls, meId, isTeacher, onCodeChange }: TabProps & { onCodeChange: (c: ClassRow) => void }) {
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const load = useCallback(async () => { try { setMembers(await fetchMembers(cls.id)) } catch (e) { setMembers([]); setError(errText(e, 'The member list')) } }, [cls.id])
  useEffect(() => { void load() }, [load])

  async function copy() {
    try { await navigator.clipboard.writeText(cls.join_code); setOk('Code copied.') } catch { setError('Could not copy. Select the code and copy it manually.') }
  }
  async function regen() {
    if (!window.confirm('Create a new code? The old code will stop working.')) return
    try { const code = await regenerateCode(cls.id); onCodeChange({ ...cls, join_code: code }); setOk('New code created.') } catch (e) { setError(errText(e, 'The new code')) }
  }
  async function toggle() {
    try { await setJoinEnabled(cls.id, !cls.join_enabled); onCodeChange({ ...cls, join_enabled: !cls.join_enabled }) } catch (e) { setError(errText(e, 'That change')) }
  }
  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.user.full_name} from this class?`)) return
    try { await removeMember(cls.id, m.user_id); await load() } catch (e) { setError(errText(e, 'The removal')) }
  }
  async function leave() {
    if (!window.confirm('Leave this class?')) return
    try { await removeMember(cls.id, meId); navigate('/app/classes') } catch (e) { setError(errText(e, 'Leaving')) }
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <section className={card} aria-label="Class code">
          <h2 className="text-sm font-bold text-navy-900">Class code</h2>
          <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-brand-dark" aria-label={`Class code ${cls.join_code.split('').join(' ')}`}>{cls.join_code}</p>
          <p className="mt-1 text-xs text-slate-500">{cls.join_enabled ? 'Students can join with this code.' : 'Joining is turned off.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void copy()} className={btnGhost}><Copy className="h-4 w-4" />Copy</button>
            <button onClick={() => void regen()} className={btnGhost}><RefreshCw className="h-4 w-4" />New code</button>
            <button onClick={() => void toggle()} className={btnGhost}>{cls.join_enabled ? 'Turn off joining' : 'Turn on joining'}</button>
          </div>
        </section>
      )}
      <ErrorNote>{error}</ErrorNote><OkNote>{ok}</OkNote>
      {members === null ? <Skeleton /> : members.length === 0 ? <Empty>No students have joined yet. Share the class code.</Empty> : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className={`${card} flex items-center gap-3 !p-3`}>
              <Avatar name={m.user.full_name} url={m.user.avatar_url} />
              <Link to={`/app/u/${m.user.username}`} className="min-w-0 flex-1"><p className="truncate font-semibold text-navy-900">{m.user.full_name}</p><p className="text-xs text-slate-500">@{m.user.username}</p></Link>
              {isTeacher && <button onClick={() => void remove(m)} className={btnDanger}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {!isTeacher && <button onClick={() => void leave()} className={btnDanger}>Leave class</button>}
    </div>
  )
}
