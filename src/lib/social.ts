import { cached } from '../offline/cache'
import { supabase } from './supabase'

export const BUCKET = 'post-images'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface Author { username: string; full_name: string; avatar_url: string | null }
export type Visibility = 'public' | 'connections'
export interface PostView {
  id: string
  author_id: string
  body: string
  image_path: string | null
  visibility: Visibility
  created_at: string
  author: Author
  likeCount: number
  commentCount: number
  liked: boolean
  bookmarked: boolean
  imageUrl: string | null
}
interface RawPost {
  id: string
  author_id: string
  body: string
  image_path: string | null
  visibility: Visibility
  created_at: string
  author: Author
  reactions: { count: number }[]
  comments: { count: number }[]
}

const POST_SELECT =
  'id, author_id, body, image_path, visibility, created_at, author:profiles!author_id(username, full_name, avatar_url), reactions(count), comments(count)'

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP, or GIF image.'
  if (file.size > MAX_IMAGE_BYTES) return 'The image must be 5 MB or smaller.'
  return null
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function isOfflineError(e: { message?: string } | null | undefined) {
  return !navigator.onLine || /fetch|network/i.test(e?.message ?? '')
}

async function hydrate(rows: RawPost[], meId: string): Promise<PostView[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p)
  const [likes, marks, urls] = await Promise.all([
    supabase.from('reactions').select('post_id').eq('user_id', meId).in('post_id', ids),
    supabase.from('bookmarks').select('post_id').in('post_id', ids),
    paths.length ? supabase.storage.from(BUCKET).createSignedUrls(paths, 3600) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ])
  const liked = new Set((likes.data ?? []).map((r: { post_id: string }) => r.post_id))
  const marked = new Set((marks.data ?? []).map((r: { post_id: string }) => r.post_id))
  const urlMap = new Map((urls.data ?? []).map((u) => [u.path, u.signedUrl]))
  return rows.map((r) => ({
    id: r.id,
    author_id: r.author_id,
    body: r.body,
    image_path: r.image_path,
    visibility: r.visibility,
    created_at: r.created_at,
    author: r.author,
    likeCount: r.reactions?.[0]?.count ?? 0,
    commentCount: r.comments?.[0]?.count ?? 0,
    liked: liked.has(r.id),
    bookmarked: marked.has(r.id),
    imageUrl: r.image_path ? (urlMap.get(r.image_path) ?? null) : null,
  }))
}

export async function fetchFeedRaw(meId: string, opts: { before?: string; authorId?: string; limit?: number } = {}) {
  let q = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(opts.limit ?? 20)
  if (opts.before) q = q.lt('created_at', opts.before)
  if (opts.authorId) q = q.eq('author_id', opts.authorId)
  const { data, error } = await q
  if (error) throw error
  return hydrate(data as unknown as RawPost[], meId)
}

export async function fetchBookmarks(meId: string) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`created_at, post:posts(${POST_SELECT})`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  const rows = (data as unknown as { post: RawPost | null }[]).map((r) => r.post).filter((p): p is RawPost => !!p)
  return hydrate(rows, meId)
}

export async function createPost(p: { id: string; authorId: string; body: string; visibility: Visibility; file?: File | null }) {
  let image_path: string | null = null
  if (p.file) {
    const ext = p.file.type === 'image/jpeg' ? 'jpg' : p.file.type.split('/')[1]
    image_path = `${p.authorId}/${p.id}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(image_path, p.file, { contentType: p.file.type, upsert: true })
    if (up.error) throw up.error
  }
  const { error } = await supabase.from('posts').insert({ id: p.id, author_id: p.authorId, body: p.body.trim(), visibility: p.visibility, image_path })
  if (error && error.code !== '23505') throw error // 23505 = this exact post already arrived (safe retry)
}

export async function deletePost(post: Pick<PostView, 'id' | 'image_path'>) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id)
  if (error) throw error
  if (post.image_path) await supabase.storage.from(BUCKET).remove([post.image_path])
}

export async function setReaction(postId: string, meId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('reactions').insert({ post_id: postId, user_id: meId })
    : await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', meId)
  if (error && error.code !== '23505') throw error
}
export async function setBookmark(postId: string, meId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('bookmarks').insert({ post_id: postId, user_id: meId })
    : await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', meId)
  if (error && error.code !== '23505') throw error
}
export async function reportPost(postId: string, meId: string, reason: string) {
  const { error } = await supabase.from('reports').insert({ post_id: postId, reporter_id: meId, reason })
  if (error && error.code !== '23505') throw error
}

// ---------- comments ----------
export interface CommentView { id: string; post_id: string; author_id: string; parent_id: string | null; body: string; created_at: string; author: Author }
export async function fetchCommentsRaw(postId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, author_id, parent_id, body, created_at, author:profiles!author_id(username, full_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as CommentView[]
}
export async function addComment(c: { id: string; postId: string; authorId: string; parentId: string | null; body: string }) {
  const { error } = await supabase.from('comments').insert({ id: c.id, post_id: c.postId, author_id: c.authorId, parent_id: c.parentId, body: c.body.trim() })
  if (error && error.code !== '23505') throw error
}
export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw error
}

// ---------- people & connections ----------
export interface PersonRow { id: string; username: string; full_name: string; avatar_url: string | null; role: string }
export interface ConnectionRow { id: string; requester_id: string; addressee_id: string; status: 'pending' | 'accepted' }
export type Relation = { kind: 'none' } | { kind: 'sent' | 'received' | 'connected'; connectionId: string }

export async function searchPeople(term: string, meId: string) {
  const clean = term.replace(/[%,()*\\]/g, ' ').trim()
  let q = supabase.from('profiles').select('id, username, full_name, avatar_url, role').neq('id', meId).limit(20)
  if (clean) q = q.or(`username.ilike.%${clean}%,full_name.ilike.%${clean}%`)
  const { data, error } = await q.order('full_name')
  if (error) throw error
  return data as PersonRow[]
}
export async function fetchConnections() {
  const { data, error } = await supabase.from('connections').select('id, requester_id, addressee_id, status')
  if (error) throw error
  return data as ConnectionRow[]
}
export function relationTo(meId: string, otherId: string, rows: ConnectionRow[]): Relation {
  const c = rows.find((r) => (r.requester_id === meId && r.addressee_id === otherId) || (r.requester_id === otherId && r.addressee_id === meId))
  if (!c) return { kind: 'none' }
  if (c.status === 'accepted') return { kind: 'connected', connectionId: c.id }
  return { kind: c.requester_id === meId ? 'sent' : 'received', connectionId: c.id }
}
export async function sendRequest(meId: string, otherId: string) {
  const { error } = await supabase.from('connections').insert({ requester_id: meId, addressee_id: otherId })
  if (error && error.code !== '23505') throw error
}
export async function acceptRequest(id: string) {
  const { error } = await supabase.from('connections').update({ status: 'accepted' }).eq('id', id)
  if (error) throw error
}
export async function removeConnection(id: string) {
  const { error } = await supabase.from('connections').delete().eq('id', id)
  if (error) throw error
}

// ---------- notifications ----------
export interface NotificationRow { id: string; type: 'comment' | 'like' | 'connection_request' | 'connection_accepted'; post_id: string | null; created_at: string; read_at: string | null; actor: Author }
export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, post_id, created_at, read_at, actor:profiles!actor_id(username, full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as unknown as NotificationRow[]
}
export async function unreadCount() {
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  return count ?? 0
}
export async function markAllRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}

// ---------- messaging ----------
export interface MessageRow { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
export interface ConversationView { id: string; other: PersonRow; last: MessageRow | null }

export async function startConversation(otherId: string) {
  const { data, error } = await supabase.rpc('start_conversation', { other: otherId })
  if (error) throw error
  return data as string
}
export async function fetchConversationsRaw(meId: string): Promise<ConversationView[]> {
  const mine = await supabase.from('conversation_members').select('conversation_id').eq('user_id', meId)
  if (mine.error) throw mine.error
  const ids = (mine.data ?? []).map((r: { conversation_id: string }) => r.conversation_id)
  if (ids.length === 0) return []
  const [members, msgs] = await Promise.all([
    supabase.from('conversation_members').select('conversation_id, user:profiles!user_id(id, username, full_name, avatar_url, role)').in('conversation_id', ids).neq('user_id', meId),
    supabase.from('messages').select('id, conversation_id, sender_id, body, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(200),
  ])
  if (members.error) throw members.error
  const last = new Map<string, MessageRow>()
  for (const m of (msgs.data ?? []) as MessageRow[]) if (!last.has(m.conversation_id)) last.set(m.conversation_id, m)
  const list = (members.data as unknown as { conversation_id: string; user: PersonRow }[]).map((m) => ({ id: m.conversation_id, other: m.user, last: last.get(m.conversation_id) ?? null }))
  return list.sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''))
}
export async function fetchMessagesRaw(conversationId: string) {
  const { data, error } = await supabase.from('messages').select('id, conversation_id, sender_id, body, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(200)
  if (error) throw error
  return data as MessageRow[]
}
export async function sendMessage(m: { id: string; conversationId: string; senderId: string; body: string }) {
  const { error } = await supabase.from('messages').insert({ id: m.id, conversation_id: m.conversationId, sender_id: m.senderId, body: m.body.trim() })
  if (error && error.code !== '23505') throw error
}

// ---------- offline-aware reads ----------
type FeedOpts = Parameters<typeof fetchFeedRaw>[1]
/** Only the first page of a feed is cached (older pages are fetched live). */
export const fetchFeed = (meId: string, opts: FeedOpts = {}) =>
  opts.before ? fetchFeedRaw(meId, opts) : cached(`feed:${opts.authorId ?? 'all'}`, () => fetchFeedRaw(meId, opts))
export const fetchComments = (postId: string) => cached(`comments:${postId}`, () => fetchCommentsRaw(postId))
export const fetchConversations = (meId: string) => cached('conversations', () => fetchConversationsRaw(meId))
export const fetchMessages = (conversationId: string) => cached(`messages:${conversationId}`, () => fetchMessagesRaw(conversationId))
