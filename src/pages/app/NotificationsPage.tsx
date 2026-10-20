import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/app/Avatar'
import { fetchNotifications, markAllRead, timeAgo, type NotificationRow } from '../../lib/social'

const text: Record<NotificationRow['type'], string> = {
  comment: 'commented on your post',
  like: 'liked your post',
  connection_request: 'sent you a connection request',
  connection_accepted: 'accepted your connection request',
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetchNotifications().then(async (n) => { setItems(n); await markAllRead() }).catch(() => { setError(true); setItems([]) })
  }, [])
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-navy-900">Notifications</h1>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Notifications could not load.</p>}
      {items === null ? <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70" /> : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">You are all caught up.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${n.read_at ? 'border-slate-200/70 bg-white' : 'border-brand/30 bg-sky-50'}`}>
              <Avatar name={n.actor.full_name} url={n.actor.avatar_url} />
              <p className="min-w-0 flex-1 text-sm"><Link to={`/app/u/${n.actor.username}`} className="font-semibold text-navy-900 hover:underline">{n.actor.full_name}</Link> {text[n.type]}.</p>
              <span className="shrink-0 text-xs text-slate-500">{timeAgo(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
