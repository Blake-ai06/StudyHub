import Dexie, { type Table } from 'dexie'
import type { CacheRow, DownloadRow, DraftRow, MetaRow, OutboxOp } from './types'

class StudyHubDB extends Dexie {
  outbox!: Table<OutboxOp, string>
  cache!: Table<CacheRow, string>
  drafts!: Table<DraftRow, string>
  downloads!: Table<DownloadRow, string>
  meta!: Table<MetaRow, string>
  constructor() {
    super('studyhub')
    this.version(1).stores({
      outbox: 'id, userId, status, createdAt',
      cache: 'key, userId',
      drafts: 'key, userId',
      downloads: 'id, userId, classId',
      meta: 'key',
    })
  }
}
export const db = new StudyHubDB()

export const lastSyncKey = (uid: string) => `lastSync:${uid}`
export async function getLastSync(uid: string) {
  return ((await db.meta.get(lastSyncKey(uid)))?.value as number | undefined) ?? null
}
export async function pendingCount(uid: string) {
  return db.outbox.where('userId').equals(uid).count()
}
/** Removes cached reads, drafts, downloads and queued changes from this device. */
export async function wipeAllLocalData() {
  await Promise.all([db.outbox.clear(), db.cache.clear(), db.drafts.clear(), db.downloads.clear(), db.meta.clear()])
}
