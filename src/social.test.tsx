import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PostCard from './components/app/PostCard'
import { commentSchema, postSchema } from './lib/schemas'
import { relationTo, timeAgo, validateImage, type ConnectionRow, type PostView } from './lib/social'

const post: PostView = {
  id: 'p1', author_id: 'u2', body: 'Anyone have the Chapter 3 notes?', image_path: null, visibility: 'public',
  created_at: new Date().toISOString(), author: { username: 'maria', full_name: 'Maria Santos', avatar_url: null },
  likeCount: 2, commentCount: 1, liked: false, bookmarked: false, imageUrl: null,
}

test('post and comment schemas enforce length limits', () => {
  expect(postSchema.safeParse({ body: '   ', visibility: 'public' }).success).toBe(false)
  expect(postSchema.safeParse({ body: 'x'.repeat(2001), visibility: 'public' }).success).toBe(false)
  expect(postSchema.safeParse({ body: 'hello', visibility: 'friends' }).success).toBe(false)
  expect(postSchema.safeParse({ body: 'hello', visibility: 'connections' }).success).toBe(true)
  expect(commentSchema.safeParse({ body: '' }).success).toBe(false)
})

test('image validation rejects wrong types and oversized files', () => {
  expect(validateImage(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toMatch(/JPG|PNG/)
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' })
  expect(validateImage(big)).toMatch(/5 MB/)
  expect(validateImage(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull()
})

test('timeAgo formats recent times', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  expect(timeAgo('2026-10-16T11:59:30Z', now)).toBe('just now')
  expect(timeAgo('2026-10-16T11:30:00Z', now)).toBe('30m ago')
  expect(timeAgo('2026-10-16T09:00:00Z', now)).toBe('3h ago')
})

test('relationTo works out connection state from either side', () => {
  const rows: ConnectionRow[] = [
    { id: 'c1', requester_id: 'me', addressee_id: 'a', status: 'pending' },
    { id: 'c2', requester_id: 'b', addressee_id: 'me', status: 'pending' },
    { id: 'c3', requester_id: 'c', addressee_id: 'me', status: 'accepted' },
  ]
  expect(relationTo('me', 'a', rows).kind).toBe('sent')
  expect(relationTo('me', 'b', rows).kind).toBe('received')
  expect(relationTo('me', 'c', rows).kind).toBe('connected')
  expect(relationTo('me', 'z', rows).kind).toBe('none')
})

test('post card shows content, counts, and fires like / bookmark callbacks', async () => {
  const user = userEvent.setup()
  const onLike = vi.fn(), onBookmark = vi.fn()
  render(<MemoryRouter><PostCard post={post} meId="u1" onLike={onLike} onBookmark={onBookmark} onDelete={vi.fn()} onReport={vi.fn()} /></MemoryRouter>)
  expect(screen.getByText('Anyone have the Chapter 3 notes?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Like' }))
  await user.click(screen.getByRole('button', { name: 'Bookmark' }))
  expect(onLike).toHaveBeenCalledWith(post)
  expect(onBookmark).toHaveBeenCalledWith(post)
})

test('only the author sees delete; others see report', () => {
  const { rerender } = render(<MemoryRouter><PostCard post={post} meId="u1" onLike={vi.fn()} onBookmark={vi.fn()} onDelete={vi.fn()} onReport={vi.fn()} /></MemoryRouter>)
  expect(screen.queryByRole('button', { name: 'Delete post' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Report post' })).toBeInTheDocument()
  rerender(<MemoryRouter><PostCard post={post} meId="u2" onLike={vi.fn()} onBookmark={vi.fn()} onDelete={vi.fn()} onReport={vi.fn()} /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Delete post' })).toBeInTheDocument()
})
