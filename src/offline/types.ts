import type { Visibility } from '../lib/social'

export type OpType = 'post.create' | 'comment.create' | 'message.send' | 'submission.save' | 'quiz.submit'
export type OpStatus = 'pending' | 'failed' | 'conflict'
export type ConflictKind = 'graded' | 'changed' | 'duplicate'

export interface Payloads {
  'post.create': { id: string; authorId: string; body: string; visibility: Visibility; file?: Blob | null; fileName?: string; fileType?: string }
  'comment.create': { id: string; postId: string; authorId: string; parentId: string | null; body: string }
  'message.send': { id: string; conversationId: string; senderId: string; body: string }
  'submission.save': {
    id: string; assignmentId: string; studentId: string; body: string
    file?: Blob | null; fileName?: string; fileType?: string
    keepFile?: { path: string; name: string } | null
    submit: boolean; baseUpdatedAt: string | null; force?: boolean
  }
  'quiz.submit': { attemptId: string; quizId: string; studentId: string; answers: Record<string, string> }
}

export interface OutboxOp<T extends OpType = OpType> {
  id: string // unique operation id, also used as the server-side idempotency key
  userId: string
  type: T
  payload: Payloads[T]
  label: string
  createdAt: number
  attempts: number
  nextAttemptAt: number
  status: OpStatus
  lastError?: string
  conflictKind?: ConflictKind
}

export interface CacheRow { key: string; userId: string; data: unknown; updatedAt: number }
export interface DraftRow { key: string; userId: string; value: unknown; updatedAt: number }
export interface DownloadRow { id: string; userId: string; classId: string; title: string; fileName: string; fileType: string; size: number; blob: Blob; savedAt: number }
export interface MetaRow { key: string; value: unknown }
