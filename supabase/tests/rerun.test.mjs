// The migrations must be safe to run again on a project where some or all of them were already applied.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { applyAll, boot } from './boot.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const counts = async (db) => (await db.query(`select (select count(*) from pg_policies)::int policies, (select count(*) from pg_tables where schemaname='public')::int tables, (select count(*) from pg_trigger where not tgisinternal)::int triggers`)).rows[0]
const log = console.log; console.log = () => {}
const db = await boot()
console.log = log
const first = await counts(db)
await applyAll(db); await applyAll(db)
assert.deepEqual(await counts(db), first, 'running the migrations again must not change or duplicate anything')

// A project where only the first migrations were run earlier (like yours), then the whole bundle is pasted.
const partial = new PGlite()
await partial.exec(fs.readFileSync(path.join(here, 'stubs.sql'), 'utf8'))
const dir = path.join(here, '..', 'migrations')
const files = fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()
for (const f of files.slice(0, 2)) await partial.exec(fs.readFileSync(path.join(dir, f), 'utf8'))
await partial.exec(fs.readFileSync(path.join(here, '..', 'all_migrations.sql'), 'utf8'))
assert.deepEqual(await counts(partial), first, 'the full bundle works on a project that already ran 0000 and 0001')
console.log('PASS  migrations and the bundle are safe to re-run (idempotent)')
