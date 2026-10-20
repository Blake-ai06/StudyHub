import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const here = path.dirname(fileURLToPath(import.meta.url))
export async function boot() {
  const db = new PGlite()
  await db.exec(fs.readFileSync(path.join(here, 'stubs.sql'), 'utf8'))
  const dir = path.join(here, '..', 'migrations')
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    try { await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('applied', f) }
    catch (e) { console.log('FAILED to apply', f, '\n  ', e.message); throw e }
  }
  return db
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await boot(); console.log('all migrations applied cleanly') }

/** Applies every migration to an existing database again (used to prove they are safe to re-run). */
export async function applyAll(db) {
  const dir = path.join(here, '..', 'migrations')
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'))
}
