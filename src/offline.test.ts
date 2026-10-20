import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { cached } from './offline/cache'
import { setCacheUser } from './offline/cache'
import { __setConnectivityForTests, pingServer } from './offline/connectivity'
import { db, getLastSync, wipeAllLocalData } from './offline/db'
import { clearDraft, getDraft, saveDraft } from './offline/drafts'
import { backoffMs, classify, enqueue, handlers, resolveConflict, retryOp, runOrQueue, syncNow } from './offline/outbox'
import { parseStoredSession, storedAuthKey } from './offline/sessionFallback'

const U = 'user-1'
const netErr = () => Object.assign(new Error('TypeError: Failed to fetch'))

beforeEach(async () => { await wipeAllLocalData(); __setConnectivityForTests(true); setCacheUser(U); vi.restoreAllMocks() })

test('classifies network, server, and permanent errors', () => {
  expect(classify(netErr())).toBe('network')
  expect(classify({ status: 503, message: 'x' })).toBe('retry')
  expect(classify({ status: 429, message: 'x' })).toBe('retry')
  expect(classify({ code: '42501', message: 'new row violates row-level security policy' })).toBe('permanent')
  expect(backoffMs(1)).toBe(5000)
  expect(backoffMs(99)).toBe(15 * 60 * 1000)
})

test('queued operations persist and survive a "restart" (reading the database again)', async () => {
  await enqueue('post.create', U, 'Post: hi', { id: 'p1', authorId: U, body: 'hi', visibility: 'public' }, 'op-1')
  const rows = await db.outbox.where('userId').equals(U).toArray()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ id: 'op-1', status: 'pending', attempts: 0 })
})

test('enqueueing the same operation id twice never creates a duplicate', async () => {
  const payload = { id: 'm1', conversationId: 'c', senderId: U, body: 'yo' }
  await enqueue('message.send', U, 'm', payload, 'same')
  await enqueue('message.send', U, 'm', payload, 'same')
  expect(await db.outbox.count()).toBe(1)
})

test('an operation is removed only after the server confirms it', async () => {
  const spy = vi.spyOn(handlers, 'comment.create').mockResolvedValueOnce(undefined)
  await enqueue('comment.create', U, 'c', { id: 'c1', postId: 'p', authorId: U, parentId: null, body: 'x' }, 'op-c')
  const res = await syncNow(U)
  expect(spy).toHaveBeenCalledTimes(1)
  expect(res.sent).toBe(1)
  expect(await db.outbox.count()).toBe(0)
  expect(await getLastSync(U)).not.toBeNull()
})

test('network failure keeps the operation, backs off, and does not record a sync', async () => {
  vi.spyOn(handlers, 'comment.create').mockRejectedValue(netErr())
  await enqueue('comment.create', U, 'c', { id: 'c1', postId: 'p', authorId: U, parentId: null, body: 'x' }, 'op-c')
  const res = await syncNow(U)
  expect(res.offline).toBe(true)
  const op = await db.outbox.get('op-c')
  expect(op).toMatchObject({ status: 'pending', attempts: 1 })
  expect(op!.nextAttemptAt).toBeGreaterThan(Date.now())
  expect(await getLastSync(U)).toBeNull()
})

test('a permanent server rejection is kept as "failed", never silently dropped, and can be retried', async () => {
  const spy = vi.spyOn(handlers, 'comment.create').mockRejectedValueOnce({ code: '42501', message: 'permission denied' })
  await enqueue('comment.create', U, 'c', { id: 'c1', postId: 'p', authorId: U, parentId: null, body: 'x' }, 'op-c')
  const res = await syncNow(U)
  expect(res.failed).toBe(1)
  expect(await db.outbox.get('op-c')).toMatchObject({ status: 'failed', lastError: 'permission denied' })
  spy.mockResolvedValueOnce(undefined)
  await retryOp('op-c')
  await syncNow(U)
  expect(await db.outbox.count()).toBe(0)
})

test('two simultaneous syncs send an operation only once', async () => {
  const spy = vi.spyOn(handlers, 'message.send').mockImplementation(() => new Promise((r) => setTimeout(r, 20)))
  await enqueue('message.send', U, 'm', { id: 'm1', conversationId: 'c', senderId: U, body: 'hi' }, 'op-m')
  await Promise.all([syncNow(U), syncNow(U), syncNow(U)])
  expect(spy).toHaveBeenCalledTimes(1)
})

test('operations are sent in the order they were created', async () => {
  const order: string[] = []
  vi.spyOn(handlers, 'comment.create').mockImplementation(async (op) => { order.push(op.payload.id) })
  await enqueue('comment.create', U, 'a', { id: 'first', postId: 'p', authorId: U, parentId: null, body: '1' }, 'a')
  await new Promise((r) => setTimeout(r, 3))
  await enqueue('comment.create', U, 'b', { id: 'second', postId: 'p', authorId: U, parentId: null, body: '2' }, 'b')
  await syncNow(U)
  expect(order).toEqual(['first', 'second'])
})

test('a conflict is held for the user; "keep mine" re-sends with force, "use server" discards', async () => {
  const spy = vi.spyOn(handlers, 'submission.save').mockResolvedValueOnce({ conflict: 'changed elsewhere', kind: 'changed' })
  await enqueue('submission.save', U, 's', { id: 's1', assignmentId: 'a', studentId: U, body: 'mine', submit: true, baseUpdatedAt: null }, 'op-s')
  const res = await syncNow(U)
  expect(res.conflicts).toBe(1)
  expect(await db.outbox.get('op-s')).toMatchObject({ status: 'conflict', conflictKind: 'changed' })
  await resolveConflict('op-s', 'keep-mine')
  expect(await db.outbox.get('op-s')).toMatchObject({ status: 'pending', payload: { force: true } })
  spy.mockResolvedValueOnce(undefined)
  await syncNow(U)
  expect(await db.outbox.count()).toBe(0)

  spy.mockResolvedValueOnce({ conflict: 'x', kind: 'graded' })
  await enqueue('submission.save', U, 's', { id: 's1', assignmentId: 'a', studentId: U, body: 'mine', submit: true, baseUpdatedAt: null }, 'op-s2')
  await syncNow(U)
  await resolveConflict('op-s2', 'use-server')
  expect(await db.outbox.count()).toBe(0)
})

test('runOrQueue queues while offline and while the network drops mid-request, but surfaces real server errors', async () => {
  const payload = { id: 'c1', postId: 'p', authorId: U, parentId: null, body: 'x' }
  __setConnectivityForTests(false)
  expect(await runOrQueue('comment.create', U, 'c', payload, 'q1')).toBe('queued')
  __setConnectivityForTests(true)
  vi.spyOn(handlers, 'comment.create').mockRejectedValueOnce(netErr())
  expect(await runOrQueue('comment.create', U, 'c', payload, 'q2')).toBe('queued')
  vi.spyOn(handlers, 'comment.create').mockRejectedValueOnce({ code: '42501', message: 'denied' })
  await expect(runOrQueue('comment.create', U, 'c', payload, 'q3')).rejects.toMatchObject({ message: 'denied' })
  vi.spyOn(handlers, 'comment.create').mockResolvedValueOnce(undefined)
  expect(await runOrQueue('comment.create', U, 'c', payload, 'q4')).toBe('sent')
  expect((await db.outbox.toArray()).map((o) => o.id).sort()).toEqual(['q1', 'q2'])
})

test('drafts persist, clear, and are separate per user', async () => {
  await saveDraft(U, 'post:new', 'half-written')
  expect(await getDraft(U, 'post:new')).toBe('half-written')
  expect(await getDraft('someone-else', 'post:new')).toBeNull()
  await clearDraft(U, 'post:new')
  expect(await getDraft(U, 'post:new')).toBeNull()
})

test('cached reads: fresh online, saved copy when offline or the network fails, error if nothing saved', async () => {
  expect(await cached('feed', async () => ['fresh'])).toEqual(['fresh'])
  await new Promise((r) => setTimeout(r, 10))
  await expect(cached('feed', async () => { throw netErr() })).resolves.toEqual(['fresh'])
  __setConnectivityForTests(false)
  const never = vi.fn(async () => ['should not be used'])
  await expect(cached('feed', never)).resolves.toEqual(['fresh'])
  await expect(cached('nothing-saved', async () => { throw netErr() })).rejects.toThrow(/fetch/)
  await expect(cached('real-error', async () => { throw { status: 403, message: 'forbidden' } })).rejects.toMatchObject({ status: 403 })
})

test('cache is scoped to the signed-in user and wiped on log out', async () => {
  await cached('classes', async () => ['mine'])
  await new Promise((r) => setTimeout(r, 10))
  setCacheUser('user-2'); __setConnectivityForTests(false)
  await expect(cached('classes', async () => { throw netErr() })).rejects.toBeDefined()
  setCacheUser(U)
  await wipeAllLocalData()
  await expect(cached('classes', async () => { throw netErr() })).rejects.toBeDefined()
})

test('reachability check: any HTTP response is online, a thrown network error is offline', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
  expect(await pingServer((async () => new Response('', { status: 401 })) as typeof fetch)).toBe(true)
  expect(await pingServer((async () => { throw new TypeError('Failed to fetch') }) as typeof fetch)).toBe(false)
  vi.unstubAllEnvs()
})

test('stored session fallback parses valid tokens only', () => {
  expect(storedAuthKey('https://txrqtghrmsnjbgfybahs.supabase.co')).toBe('sb-txrqtghrmsnjbgfybahs-auth-token')
  expect(parseStoredSession(JSON.stringify({ access_token: 'a', user: { id: 'u' } }))?.user.id).toBe('u')
  expect(parseStoredSession('not json')).toBeNull()
  expect(parseStoredSession(JSON.stringify({ access_token: 'a' }))).toBeNull()
  expect(parseStoredSession(null)).toBeNull()
})

test('a forced "Sync now" is not swallowed by a gentler sync that is already running', async () => {
  const spy = vi.spyOn(handlers, 'comment.create').mockResolvedValue(undefined)
  await enqueue('comment.create', U, 'c', { id: 'c1', postId: 'p', authorId: U, parentId: null, body: 'x' }, 'op-b')
  await db.outbox.update('op-b', { nextAttemptAt: Date.now() + 60_000 }) // still in back-off
  const gentle = syncNow(U) // skips the op because of the back-off
  const forced = syncNow(U, { force: true }) // must still deliver it
  await Promise.all([gentle, forced])
  expect(spy).toHaveBeenCalledTimes(1)
  expect(await db.outbox.count()).toBe(0)
})
