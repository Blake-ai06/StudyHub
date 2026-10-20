import { supabase } from './supabase'

const grab = async (table: string, column: string, uid: string) => {
  const { data, error } = await supabase.from(table).select('*').eq(column, uid)
  if (error) throw error
  return data
}

/** Everything the signed-in user created or owns, as plain data they can download. Other people's content is not included. */
export async function exportMyData(uid: string) {
  const [profile, posts, comments, reactions, bookmarks, connections, submissions, quizAttempts, messagesSent, enrollments] = await Promise.all([
    grab('profiles', 'id', uid), grab('posts', 'author_id', uid), grab('comments', 'author_id', uid), grab('reactions', 'user_id', uid),
    grab('bookmarks', 'user_id', uid), supabase.from('connections').select('*').then((r) => { if (r.error) throw r.error; return r.data }),
    grab('submissions', 'student_id', uid), grab('quiz_attempts', 'student_id', uid), grab('messages', 'sender_id', uid), grab('enrollments', 'user_id', uid),
  ])
  return { exportedAt: new Date().toISOString(), profile: profile[0] ?? null, posts, comments, reactions, bookmarks, connections, submissions, quizAttempts, messagesSent, enrollments }
}

export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The typed username must match exactly (ignoring case and surrounding spaces) before deletion is allowed. */
export const canConfirmDelete = (typed: string, username: string) => typed.trim().toLowerCase() === username.toLowerCase() && username.length > 0

/** Removes the user's uploaded files, then deletes the account (and, by cascade, all their data) on the server. Needs a connection. */
export async function deleteMyAccount(uid: string) {
  const [imgs, subs, mats] = await Promise.all([
    supabase.from('posts').select('image_path').eq('author_id', uid).not('image_path', 'is', null),
    supabase.from('submissions').select('file_path').eq('student_id', uid).not('file_path', 'is', null),
    supabase.from('materials').select('file_path').eq('created_by', uid).not('file_path', 'is', null),
  ])
  for (const r of [imgs, subs, mats]) if (r.error) throw r.error
  const rm = async (bucket: string, paths: string[]) => { if (paths.length) { const { error } = await supabase.storage.from(bucket).remove(paths); if (error) throw error } }
  await rm('post-images', (imgs.data ?? []).map((r: { image_path: string }) => r.image_path))
  await rm('submission-files', (subs.data ?? []).map((r: { file_path: string }) => r.file_path))
  await rm('class-files', (mats.data ?? []).map((r: { file_path: string }) => r.file_path))
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
}
