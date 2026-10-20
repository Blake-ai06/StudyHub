import { addComment, createPost, sendMessage } from '../lib/social'
import { fetchMyAttemptRaw, fetchMySubmissionRaw, saveSubmission, submitQuiz } from '../lib/classroom'
import { isNetworkError } from './cache'
import { isOffline } from './connectivity'
import { db, lastSyncKey } from './db'
import type { ConflictKind, OpType, OutboxOp, Payloads } from './types'

export type ErrKind = 'network' | 'retry' | 'permanent'
/** network: server unreachable (keep waiting). retry: server hiccup (back off). permanent: the server said no. */
export function classify(e: unknown): ErrKind {
  if (isNetworkError(e)) return 'network'
  const err = e as { status?: number | string; statusCode?: number | string }
  const st = Number(err?.status ?? err?.statusCode)
  if (st >= 500 || st === 429 || st === 408) return 'retry'
  return 'permanent'
}
export const backoffMs = (attempts: number) => Math.min(5000 * 2 ** Math.max(0, attempts - 1), 15 * 60 * 1000)

type Outcome = void | { conflict: string; kind: ConflictKind }
type Handler<T extends OpType> = (op: OutboxOp<T>) => Promise<Outcome>
const toFile = (blob: Blob | null | undefined, name?: string, type?: string) => (blob ? new File([blob], name ?? 'file', { type: type ?? blob.type }) : null)

// Every handler is idempotent: client-generated ids + "already exists" treated as success + upserts.
export const handlers: { [K in OpType]: Handler<K> } = {
  'post.create': async ({ payload: p }) => {
    await createPost({ id: p.id, authorId: p.authorId, body: p.body, visibility: p.visibility, file: toFile(p.file, p.fileName, p.fileType) })
  },
  'comment.create': async ({ payload: p }) => {
    await addComment({ id: p.id, postId: p.postId, authorId: p.authorId, parentId: p.parentId, body: p.body })
  },
  'message.send': async ({ payload: p }) => {
    await sendMessage({ id: p.id, conversationId: p.conversationId, senderId: p.senderId, body: p.body })
  },
  'submission.save': async ({ payload: p }) => {
    const server = await fetchMySubmissionRaw(p.assignmentId, p.studentId) // always ask the server, never the cache
    const wanted = p.submit ? 'submitted' : 'draft'
    // Our own earlier attempt may have landed even though the response was lost: that is success, not a conflict.
    if (server && server.id === p.id && (server.body ?? '') === p.body.trim() && server.status === wanted) return
    if (server?.grade != null) return { conflict: 'Your teacher already graded this work, so your offline changes were not applied.', kind: 'graded' }
    if (server && !p.force && server.updated_at !== p.baseUpdatedAt) {
      return { conflict: 'This work was changed somewhere else (another device) after you started editing offline.', kind: 'changed' }
    }
    await saveSubmission({
      id: server?.id ?? p.id, assignmentId: p.assignmentId, studentId: p.studentId, body: p.body,
      file: toFile(p.file, p.fileName, p.fileType), keepFile: p.keepFile ?? (server?.file_path ? { path: server.file_path, name: server.file_name ?? 'file' } : null), submit: p.submit,
    })
  },
  'quiz.submit': async ({ payload: p }) => {
    const r = await submitQuiz(p.attemptId, p.quizId, p.answers)
    if (!r.already) return
    const mine = await fetchMyAttemptRaw(p.quizId, p.studentId)
    if (mine?.id !== p.attemptId) return { conflict: 'You already took this quiz on another device. The server kept the first attempt, so this one was not counted.', kind: 'duplicate' }
  },
}

export async function enqueue<T extends OpType>(type: T, userId: string, label: string, payload: Payloads[T], id: string = crypto.randomUUID()) {
  const op: OutboxOp<T> = { id, userId, type, payload, label, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0, status: 'pending' }
  // put() with the same id replaces instead of duplicating, so double taps cannot queue the same operation twice.
  await db.outbox.put(op as OutboxOp)
  return op
}

/**
 * Try to send now; if the server is unreachable, keep the operation in the persistent outbox instead.
 * Returns 'sent' only when the server confirmed. Permanent server rejections are thrown so the UI can show them.
 */
export async function runOrQueue<T extends OpType>(type: T, userId: string, label: string, payload: Payloads[T], opId?: string): Promise<'sent' | 'queued'> {
  const op = { id: opId ?? crypto.randomUUID(), userId, type, payload, label, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0, status: 'pending' as const } as OutboxOp<T>
  if (isOffline()) { await db.outbox.put(op as OutboxOp); return 'queued' }
  try {
    const out = await (handlers[type] as Handler<T>)(op)
    if (out) throw new Error(out.conflict)
    return 'sent'
  } catch (e) {
    if (classify(e) === 'network') { await db.outbox.put(op as OutboxOp); return 'queued' }
    throw e
  }
}

export interface SyncResult { sent: number; failed: number; conflicts: number; offline: boolean; skipped?: boolean }
let running: Promise<SyncResult> | null = null
let runningForce = false

async function run(userId: string, ignoreBackoff: boolean): Promise<SyncResult> {
  const res: SyncResult = { sent: 0, failed: 0, conflicts: 0, offline: false }
  const ops = await db.outbox.where('userId').equals(userId).sortBy('createdAt')
  for (const op of ops) {
    if (op.status !== 'pending') continue
    if (!ignoreBackoff && op.nextAttemptAt > Date.now()) continue
    try {
      const out = await (handlers[op.type] as Handler<typeof op.type>)(op as never)
      if (out) {
        await db.outbox.update(op.id, { status: 'conflict', lastError: out.conflict, conflictKind: out.kind })
        res.conflicts += 1
      } else {
        await db.outbox.delete(op.id) // only after the server has confirmed
        res.sent += 1
      }
    } catch (e) {
      const kind = classify(e)
      const message = (e as Error)?.message ?? 'Unknown error'
      if (kind === 'network') {
        await db.outbox.update(op.id, { attempts: op.attempts + 1, nextAttemptAt: Date.now() + backoffMs(op.attempts + 1), lastError: 'Waiting for a connection' })
        res.offline = true
        break // everything after this would fail too
      }
      if (kind === 'retry') {
        await db.outbox.update(op.id, { attempts: op.attempts + 1, nextAttemptAt: Date.now() + backoffMs(op.attempts + 1), lastError: message })
      } else {
        await db.outbox.update(op.id, { status: 'failed', attempts: op.attempts + 1, lastError: message }) // kept, never silently dropped
        res.failed += 1
      }
    }
  }
  if (!res.offline) await db.meta.put({ key: lastSyncKey(userId), value: Date.now() })
  return res
}

/** Single-flight, and single across tabs when the Web Locks API exists, so a retry can never double-send. */
export function syncNow(userId: string, opts: { force?: boolean } = {}): Promise<SyncResult> {
  const force = !!opts.force
  if (running) {
    if (!force || runningForce) return running
    // A forced run ("Sync now", or the connection just came back) must not be swallowed by a gentler run
    // already in flight, because that one skips operations that are still in their retry back-off.
    return running.then(() => syncNow(userId, opts))
  }
  runningForce = force
  const go = async (): Promise<SyncResult> => {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks
    if (!locks) return run(userId, !!opts.force)
    const r = await locks.request('studyhub-sync', { ifAvailable: true }, async (lock) => (lock ? run(userId, !!opts.force) : ({ sent: 0, failed: 0, conflicts: 0, offline: false, skipped: true } as SyncResult)))
    return r
  }
  running = go().finally(() => { running = null; runningForce = false })
  return running
}

export const retryOp = (id: string) => db.outbox.update(id, { status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: undefined, conflictKind: undefined })
export const discardOp = (id: string) => db.outbox.delete(id)
/** "Keep mine" re-sends a submission over the server version; "Use server's" drops the local change. */
export async function resolveConflict(id: string, choice: 'keep-mine' | 'use-server') {
  if (choice === 'use-server') return db.outbox.delete(id)
  const op = await db.outbox.get(id)
  if (!op || op.type !== 'submission.save') return
  await db.outbox.update(id, { payload: { ...(op.payload as Payloads['submission.save']), force: true }, status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: undefined, conflictKind: undefined })
}
