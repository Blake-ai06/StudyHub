// Tests the database security rules (Row Level Security, triggers, functions) in an in-memory Postgres.
// It runs the real migration files. It does NOT run Supabase itself (PostgREST, Auth, Storage API).
import assert from 'node:assert/strict'
import { boot } from './boot.mjs'

const db = await boot()
const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const [S1, S2, S3, T1, T2, AD, S4, S8, S9] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(u)
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const as = async (uid, fn) => {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ''])
  await db.exec('set role authenticated')
  try { return await fn() } finally { await db.exec('reset role') }
}
const asAnon = async (fn) => { await db.query("select set_config('request.jwt.claim.sub', '', false)"); await db.exec('set role anon'); try { return await fn() } finally { await db.exec('reset role') } }
const rejects = async (p, re) => { try { await p } catch (e) { if (re && !re.test(e.message)) throw new Error(`rejected with the wrong error: ${e.message}`); return } throw new Error('expected the statement to be rejected, but it succeeded') }
const affected = async (sql, params = []) => (await db.query(sql, params)).affectedRows ?? 0
const RLS = /row-level security|violates/

let pass = 0, fail = 0
async function t(name, fn) { try { await fn(); pass++; console.log('PASS ', name) } catch (e) { fail++; console.log('FAIL ', name, '\n       ', e.message.split('\n')[0]) } }

// ---------- setup (as the dashboard/superuser) ----------
for (const [id, email, user, name] of [[S1, 'a@x', 'alice', 'Alice A'], [S2, 'b@x', 'bob', 'Bob B'], [S3, 'c@x', 'alice', 'Cara C'], [T1, 't1@x', 'teach_one', 'Teacher One'], [T2, 't2@x', 'teach_two', 'Teacher Two'], [AD, 'ad@x', 'admin_user', 'Admin'], [S4, 'd@x', 'dan', 'Dan D'], [S8, 'h@x', 'hana', 'Hana H'], [S9, 'i@x', 'ivan', 'Ivan I']]) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)', [id, email, JSON.stringify({ username: user, full_name: name })])
}
await q("update profiles set role = 'teacher' where id in ($1, $2)", [T1, T2])
await q("update profiles set role = 'admin' where id = $1", [AD])

await t('sign-up trigger makes everyone a student, handles duplicate usernames', async () => {
  const rows = await q('select id, username, role from profiles order by id')
  assert.equal(rows.length, 9)
  assert.equal(rows.find((r) => r.id === S1).role, 'student')
  assert.equal(rows.find((r) => r.id === S1).username, 'alice')
  assert.match(rows.find((r) => r.id === S3).username, /^alice_/, 'second "alice" gets a suffix instead of failing sign-up')
})
await t('a user cannot promote themselves; they can edit their own name but not others', async () => {
  await as(S1, async () => {
    await rejects(q("update profiles set role = 'teacher' where id = $1", [S1]), /Only an administrator/)
    await rejects(q("update profiles set role = 'admin' where id = $1", [S1]), /Only an administrator/)
    assert.equal(await affected("update profiles set full_name = 'Alice Renamed' where id = $1", [S1]), 1)
    assert.equal(await affected("update profiles set full_name = 'Hacked' where id = $1", [S2]), 0)
  })
})
await t('an administrator can change roles', async () => {
  await as(AD, async () => { assert.equal(await affected("update profiles set role = 'teacher' where id = $1", [S4]), 1); await q("update profiles set role = 'student' where id = $1", [S4]) })
})
await t('signed-out visitors can read nothing and write nothing (except the contact form)', async () => {
  await asAnon(async () => {
    assert.equal((await q('select * from profiles')).length, 0)
    assert.equal((await q('select * from posts')).length, 0)
    await rejects(q("insert into posts (author_id, body) values ($1, 'x')", [S1]), RLS)
    await q("insert into contact_messages (name, email, message) values ('Visitor', 'v@x.com', 'Hello there team')")
    assert.equal((await q('select * from contact_messages')).length, 0, 'nobody can read contact messages through the API')
    await rejects(q("select join_class('ABCD1234')"), /permission denied/)
  })
})

// ---------- posts, connections, social ----------
let P1, P2
await t('posts: public vs connections-only visibility; no posting or deleting as someone else', async () => {
  await as(S1, async () => {
    P1 = (await q("insert into posts (author_id, body, visibility) values ($1, 'public post', 'public') returning id", [S1]))[0].id
    P2 = (await q("insert into posts (author_id, body, visibility) values ($1, 'friends only', 'connections') returning id", [S1]))[0].id
  })
  await as(S2, async () => {
    assert.deepEqual((await q('select body from posts order by body')).map((r) => r.body), ['public post'])
    await rejects(q("insert into posts (author_id, body) values ($1, 'impersonation')", [S1]), RLS)
    assert.equal(await affected('delete from posts where id = $1', [P1]), 0)
    assert.equal(await affected("update posts set body = 'defaced' where id = $1", [P1]), 0)
  })
  await as(S1, async () => assert.equal(await affected("update posts set author_id = $1 where id = $2", [S2, P1]), 1)) // allowed update, but...
  assert.equal((await q('select author_id from posts where id = $1', [P1]))[0].author_id, S1, 'author_id cannot be changed')
})
await t('post size limits are enforced by the database', async () => {
  await as(S1, async () => {
    await rejects(q("insert into posts (author_id, body) values ($1, '   ')", [S1]))
    await rejects(q("insert into posts (author_id, body) values ($1, $2)", [S1, 'x'.repeat(2001)]))
    await rejects(q("insert into posts (author_id, body, visibility) values ($1, 'x', 'everyone')", [S1]))
  })
})
let C1
await t('connections: only the addressee can accept; strangers see nothing; no duplicates', async () => {
  await as(S1, async () => {
    C1 = (await q('insert into connections (requester_id, addressee_id) values ($1, $2) returning id', [S1, S2]))[0].id
    assert.equal(await affected("update connections set status = 'accepted' where id = $1", [C1]), 0, 'requester cannot accept their own request')
    await rejects(q('insert into connections (requester_id, addressee_id) values ($1, $2)', [S1, S2]), /unique|duplicate/)
    await rejects(q("insert into connections (requester_id, addressee_id, status) values ($1, $2, 'accepted')", [S1, S4]), RLS)
    await rejects(q('insert into connections (requester_id, addressee_id) values ($1, $1)', [S1]))
  })
  await as(S3, async () => {
    assert.equal((await q('select * from connections')).length, 0)
    await rejects(q('insert into connections (requester_id, addressee_id) values ($1, $2)', [S1, S3]), RLS)
  })
  await as(S2, async () => {
    await rejects(q('insert into connections (requester_id, addressee_id) values ($1, $2)', [S2, S1]), /unique|duplicate/, 'reverse duplicate')
    assert.equal(await affected("update connections set status = 'accepted' where id = $1", [C1]), 1)
  })
  await as(S2, async () => assert.deepEqual((await q('select body from posts order by body')).map((r) => r.body), ['friends only', 'public post']))
})
await t('comments, reactions, bookmarks: visibility rules and no impersonation', async () => {
  await as(S3, async () => {
    await rejects(q("insert into comments (post_id, author_id, body) values ($1, $2, 'sneaky')", [P2, S3]), RLS)
    await rejects(q('insert into reactions (post_id, user_id) values ($1, $2)', [P2, S3]), RLS)
  })
  await as(S2, async () => {
    await q("insert into comments (post_id, author_id, body) values ($1, $2, 'nice')", [P1, S2])
    await q('insert into reactions (post_id, user_id) values ($1, $2)', [P1, S2])
    await rejects(q('insert into reactions (post_id, user_id) values ($1, $2)', [P1, S2]), /duplicate|unique/)
    await rejects(q('insert into reactions (post_id, user_id) values ($1, $2)', [P1, S1]), RLS)
    await rejects(q("insert into comments (post_id, author_id, body) values ($1, $2, 'as alice')", [P1, S1]), RLS)
    await q('insert into bookmarks (post_id, user_id) values ($1, $2)', [P1, S2])
  })
  await as(S1, async () => assert.equal((await q('select * from bookmarks')).length, 0, 'bookmarks are private'))
  await as(S3, async () => assert.equal((await q('select * from comments')).length, 1, 'comment on a public post is visible; none from hidden post'))
})
await t('notifications are created by triggers, private, and cannot be forged', async () => {
  await as(S1, async () => {
    const types = (await q('select type from notifications order by type')).map((r) => r.type)
    assert.deepEqual(types, ['comment', 'connection_accepted', 'like'])
    await rejects(q("insert into notifications (user_id, actor_id, type) values ($1, $2, 'like')", [S1, S2]), RLS)
    assert.equal(await affected('update notifications set read_at = now() where read_at is null'), 3)
  })
  await as(S2, async () => assert.deepEqual((await q('select type from notifications')).map((r) => r.type), ['connection_request']))
  await as(S3, async () => assert.equal((await q('select * from notifications')).length, 0))
})
let CONV
await t('messaging: only connections, only members', async () => {
  await as(S3, async () => await rejects(q('select start_conversation($1)', [S1]), /only message your connections/))
  await as(S1, async () => {
    CONV = (await q('select start_conversation($1) as id', [S2]))[0].id
    assert.equal((await q('select start_conversation($1) as id', [S2]))[0].id, CONV, 'idempotent')
    await q("insert into messages (conversation_id, sender_id, body) values ($1, $2, 'hi bob')", [CONV, S1])
    await rejects(q("insert into messages (conversation_id, sender_id, body) values ($1, $2, 'as bob')", [CONV, S2]), RLS)
  })
  await as(S2, async () => assert.equal((await q('select * from messages where conversation_id = $1', [CONV])).length, 1))
  await as(S3, async () => {
    assert.equal((await q('select * from messages')).length, 0)
    assert.equal((await q('select * from conversations')).length, 0)
    await rejects(q("insert into messages (conversation_id, sender_id, body) values ($1, $2, 'intruder')", [CONV, S3]), RLS)
  })
})
await t('reporting a post is allowed; reading reports is admin only', async () => {
  await as(S2, async () => await q("insert into reports (reporter_id, post_id, reason) values ($1, $2, 'spam')", [S2, P1]))
  await as(S1, async () => assert.equal((await q('select * from reports')).length, 0))
  await as(AD, async () => assert.equal((await q('select * from reports')).length, 1))
})

// ---------- classroom ----------
let CLS, CODE, A1, A2
await t('only teachers create classes, and only for themselves', async () => {
  await as(S1, async () => await rejects(q("insert into classes (teacher_id, name) values ($1, 'Student class')", [S1]), RLS))
  await as(T1, async () => {
    const r = (await q("insert into classes (teacher_id, name) values ($1, 'Math 101') returning id, join_code", [T1]))[0]
    CLS = r.id; CODE = r.join_code
    assert.match(CODE, /^[0-9A-F]{8}$/)
    await rejects(q("insert into classes (teacher_id, name) values ($1, 'Stolen')", [T2]), RLS)
  })
})
await t('join codes: wrong code is null, case/space tolerant, can be switched off, brute force is throttled', async () => {
  await as(S1, async () => {
    assert.equal((await q("select join_class('WRONG000') as c"))[0].c, null)
    assert.equal((await q('select join_class($1) as c', [`  ${CODE.toLowerCase()} `]))[0].c, CLS)
  })
  await as(T1, async () => await q('update classes set join_enabled = false where id = $1', [CLS]))
  await as(S2, async () => assert.equal((await q('select join_class($1) as c', [CODE]))[0].c, null, 'closed class cannot be joined'))
  await as(T1, async () => await q('update classes set join_enabled = true where id = $1', [CLS]))
  await as(S2, async () => assert.equal((await q('select join_class($1) as c', [CODE]))[0].c, CLS))
  await as(S3, async () => {
    for (let i = 0; i < 10; i++) await q("select join_class('NOPE0000')")
    await rejects(q('select join_class($1)', [CODE]), /Too many wrong codes/)
  })
})
await t('class data is visible only to its teacher and enrolled students', async () => {
  await as(S1, async () => assert.equal((await q('select * from classes')).length, 1))
  await as(S3, async () => assert.equal((await q('select * from classes')).length, 0))
  await as(T2, async () => assert.equal((await q('select * from classes')).length, 0, 'another teacher cannot see it'))
  await as(S1, async () => assert.equal((await q('select * from enrollments')).length, 2, 'classmates can see the roster'))
  await as(S3, async () => assert.equal((await q('select * from enrollments')).length, 0))
})
await t('students and other teachers cannot add announcements, materials, assignments, or quizzes', async () => {
  for (const uid of [S1, T2, S3]) {
    await as(uid, async () => {
      await rejects(q("insert into announcements (class_id, author_id, body) values ($1, $2, 'x')", [CLS, uid]), RLS)
      await rejects(q("insert into materials (class_id, created_by, title) values ($1, $2, 'x')", [CLS, uid]), RLS)
      await rejects(q("insert into assignments (class_id, created_by, title) values ($1, $2, 'x')", [CLS, uid]), RLS)
      await rejects(q("insert into quizzes (class_id, created_by, title) values ($1, $2, 'x')", [CLS, uid]), RLS)
    })
  }
  await as(S1, async () => assert.equal(await affected('delete from classes where id = $1', [CLS]), 0))
})
await t('the teacher can add class content; students can read it; strangers cannot', async () => {
  await as(T1, async () => {
    await q("insert into announcements (class_id, author_id, body) values ($1, $2, 'Welcome')", [CLS, T1])
    await q("insert into materials (class_id, created_by, title, file_path, file_size) values ($1, $2, 'Notes', $3, 1000)", [CLS, T1, `${CLS}/n.pdf`])
    A1 = (await q("insert into assignments (class_id, created_by, title, points, due_at) values ($1, $2, 'Problem Set', 100, now() + interval '3 days') returning id", [CLS, T1]))[0].id
    A2 = (await q("insert into assignments (class_id, created_by, title, points) values ($1, $2, 'Other', 10) returning id", [CLS, T1]))[0].id
    await rejects(q("insert into materials (class_id, created_by, title, file_size) values ($1, $2, 'huge', 99999999)", [CLS, T1]))
  })
  await as(S1, async () => { assert.equal((await q('select * from announcements')).length, 1); assert.equal((await q('select * from materials')).length, 1); assert.equal((await q('select * from assignments')).length, 2) })
  await as(S3, async () => { assert.equal((await q('select * from announcements')).length, 0); assert.equal((await q('select * from assignments')).length, 0) })
})

// ---------- submissions & grades ----------
let SUB1
await t('a student cannot create a pre-graded submission or edit their own grade', async () => {
  await as(S1, async () => {
    SUB1 = (await q("insert into submissions (assignment_id, student_id, body, status, grade, feedback) values ($1, $2, 'my answer', 'submitted', 100, 'self-graded') returning id", [A1, S1]))[0].id
    const r = (await q('select grade, feedback, status, submitted_at from submissions where id = $1', [SUB1]))[0]
    assert.equal(r.grade, null); assert.equal(r.feedback, null); assert.equal(r.status, 'submitted'); assert.ok(r.submitted_at, 'server stamps submitted_at')
    await q("update submissions set grade = 100, feedback = 'perfect', graded_at = now() where id = $1", [SUB1])
    assert.equal((await q('select grade, feedback from submissions where id = $1', [SUB1]))[0].grade, null, 'grade edit is ignored')
    await rejects(q("insert into submissions (assignment_id, student_id, body) values ($1, $2, 'again')", [A1, S1]), /unique|duplicate/)
    await rejects(q("insert into submissions (assignment_id, student_id, body) values ($1, $2, 'for bob')", [A2, S2]), RLS)
  })
})
await t('students cannot read each other\'s work; outsiders cannot submit; only the class teacher sees all', async () => {
  await as(S2, async () => assert.equal((await q('select * from submissions')).length, 0))
  await as(S3, async () => { assert.equal((await q('select * from submissions')).length, 0); await rejects(q("insert into submissions (assignment_id, student_id, body) values ($1, $2, 'x')", [A1, S3]), RLS) })
  await as(T2, async () => assert.equal((await q('select * from submissions')).length, 0))
  await as(T1, async () => assert.equal((await q('select * from submissions')).length, 1))
})
await t('teacher grading: points cap, grade/feedback only, then the student is locked out', async () => {
  await as(T1, async () => {
    await rejects(q('update submissions set grade = 150 where id = $1', [SUB1]), /exceed/)
    await q("update submissions set grade = 90, feedback = 'good work', body = 'TEACHER EDIT' where id = $1", [SUB1])
    const r = (await q('select grade, feedback, body, graded_at from submissions where id = $1', [SUB1]))[0]
    assert.equal(Number(r.grade), 90); assert.equal(r.feedback, 'good work'); assert.equal(r.body, 'my answer', 'teacher cannot rewrite student work'); assert.ok(r.graded_at)
  })
  await as(T2, async () => assert.equal(await affected('update submissions set grade = 100 where id = $1', [SUB1]), 0, 'another teacher cannot grade'))
  await as(S1, async () => {
    assert.equal(await affected("update submissions set body = 'changed after grading' where id = $1", [SUB1]), 0)
    const r = (await q('select grade, body from submissions where id = $1', [SUB1]))[0]
    assert.equal(Number(r.grade), 90); assert.equal(r.body, 'my answer')
  })
})
await t('a submitted assignment cannot be un-submitted', async () => {
  await as(S2, async () => {
    const id = (await q("insert into submissions (assignment_id, student_id, body, status) values ($1, $2, 'bob', 'submitted') returning id", [A2, S2]))[0].id
    await q("update submissions set status = 'draft' where id = $1", [id])
    assert.equal((await q('select status from submissions where id = $1', [id]))[0].status, 'submitted')
  })
})

// ---------- quizzes ----------
let QZ, Q1, Q2, OPT = {}
await t('teacher builds a quiz; students cannot see it while unpublished', async () => {
  await as(T1, async () => {
    QZ = (await q("insert into quizzes (class_id, created_by, title, due_at) values ($1, $2, 'Quiz 1', now() + interval '2 days') returning id", [CLS, T1]))[0].id
    for (const [n, pts] of [[1, 2], [2, 3]]) {
      const qid = (await q('insert into quiz_questions (quiz_id, prompt, points, position) values ($1, $2, $3, $4) returning id', [QZ, `Question ${n}`, pts, n]))[0].id
      if (n === 1) Q1 = qid; else Q2 = qid
      for (const k of ['right', 'wrong']) {
        const oid = (await q('insert into quiz_options (question_id, label, position) values ($1, $2, $3) returning id', [qid, `${k} ${n}`, k === 'right' ? 0 : 1]))[0].id
        OPT[`${k}${n}`] = oid
      }
      await q('insert into quiz_keys (question_id, option_id) values ($1, $2)', [qid, OPT[`right${n}`]])
    }
  })
  await as(S1, async () => { for (const tbl of ['quizzes', 'quiz_questions', 'quiz_options']) assert.equal((await q(`select * from ${tbl}`)).length, 0, tbl) })
  await as(T1, async () => await q('update quizzes set published = true where id = $1', [QZ]))
})
await t('students can see questions and options but never the answer key', async () => {
  await as(S1, async () => {
    assert.equal((await q('select * from quizzes')).length, 1)
    assert.equal((await q('select * from quiz_questions')).length, 2)
    assert.equal((await q('select * from quiz_options')).length, 4)
    assert.equal((await q('select * from quiz_keys')).length, 0, 'answer key is hidden')
    await rejects(q('insert into quiz_keys (question_id, option_id) values ($1, $2)', [Q1, OPT.wrong1]), RLS)
    await rejects(q('insert into quiz_attempts (quiz_id, student_id, score, max_score) values ($1, $2, 5, 5)', [QZ, S1]), RLS)
  })
  await as(S3, async () => assert.equal((await q('select * from quizzes')).length, 0, 'outsiders see nothing'))
  await as(T1, async () => assert.equal((await q('select * from quiz_keys')).length, 2))
  await as(T2, async () => assert.equal((await q('select * from quiz_keys')).length, 0))
})
await t('quiz is scored on the server; second attempt is not counted; bad option ids score zero', async () => {
  await as(S1, async () => {
    const aid = '00000000-0000-4000-8000-0000000000a1'
    const r = (await q('select submit_quiz($1, $2, $3::jsonb) as r', [aid, QZ, JSON.stringify({ [Q1]: OPT.right1, [Q2]: OPT.wrong2 })]))[0].r
    assert.equal(Number(r.score), 2); assert.equal(Number(r.max_score), 5); assert.equal(r.already, false)
    const again = (await q('select submit_quiz($1, $2, $3::jsonb) as r', ['00000000-0000-4000-8000-0000000000a2', QZ, JSON.stringify({ [Q1]: OPT.right1, [Q2]: OPT.right2 })]))[0].r
    assert.equal(again.already, true); assert.equal(Number(again.score), 2, 'cheating by resubmitting does not change the score')
    assert.equal(await affected('update quiz_attempts set score = 5'), 0, 'students cannot edit scores')
  })
  await as(S2, async () => {
    const r = (await q('select submit_quiz($1, $2, $3::jsonb) as r', ['00000000-0000-4000-8000-0000000000b1', QZ, JSON.stringify({ [Q1]: OPT.right2, [Q2]: 'not-a-uuid' })]))[0].r
    assert.equal(Number(r.score), 0, 'an option from a different question does not score')
  })
  await as(S3, async () => await rejects(q('select submit_quiz($1, $2, $3::jsonb)', ['00000000-0000-4000-8000-0000000000c1', QZ, '{}']), /not enrolled/))
})
await t('attempts are private to the student and the class teacher', async () => {
  await as(S1, async () => { assert.equal((await q('select * from quiz_attempts')).length, 1); assert.equal((await q('select * from quiz_answers')).length, 2) })
  await as(S2, async () => assert.equal((await q('select * from quiz_attempts')).length, 1))
  await as(T1, async () => assert.equal((await q('select * from quiz_attempts')).length, 2))
  await as(T2, async () => assert.equal((await q('select * from quiz_attempts')).length, 0))
})
await t('the server rejects late quiz attempts and unpublished quizzes', async () => {
  await q('select 1')
  await as(S8, async () => await q('select join_class($1)', [CODE]))
  await q("update quizzes set due_at = now() - interval '1 day' where id = $1", [QZ])
  await as(S8, async () => await rejects(q('select submit_quiz($1, $2, $3::jsonb)', ['00000000-0000-4000-8000-0000000000c2', QZ, '{}']), /past its deadline/))
  await q("update quizzes set published = false where id = $1", [QZ])
  await as(S8, async () => await rejects(q('select submit_quiz($1, $2, $3::jsonb)', ['00000000-0000-4000-8000-0000000000c3', QZ, '{}']), /not available/))
})

// ---------- storage ----------
await t('class files: only the class teacher uploads; only members read', async () => {
  const path = `${CLS}/lesson.pdf`
  await as(S1, async () => await rejects(q("insert into storage.objects (bucket_id, name) values ('class-files', $1)", [path]), RLS))
  await as(T2, async () => await rejects(q("insert into storage.objects (bucket_id, name) values ('class-files', $1)", [path]), RLS))
  await as(T1, async () => await q("insert into storage.objects (bucket_id, name) values ('class-files', $1)", [path]))
  await as(S1, async () => assert.equal((await q("select * from storage.objects where bucket_id = 'class-files'")).length, 1))
  await as(S4, async () => assert.equal((await q("select * from storage.objects where bucket_id = 'class-files'")).length, 0, 'not enrolled'))
})
await t('submission files: only into your own folder; only the owner and the class teacher read', async () => {
  await as(S1, async () => {
    await q("insert into storage.objects (bucket_id, name) values ('submission-files', $1)", [`${A1}/${S1}/work.pdf`])
    await rejects(q("insert into storage.objects (bucket_id, name) values ('submission-files', $1)", [`${A1}/${S2}/work.pdf`]), RLS)
  })
  await as(S4, async () => await rejects(q("insert into storage.objects (bucket_id, name) values ('submission-files', $1)", [`${A1}/${S4}/work.pdf`]), RLS))
  await as(T1, async () => assert.equal((await q("select * from storage.objects where bucket_id = 'submission-files'")).length, 1))
  await as(S2, async () => assert.equal((await q("select * from storage.objects where bucket_id = 'submission-files'")).length, 0, 'classmates cannot read it'))
  await as(T2, async () => assert.equal((await q("select * from storage.objects where bucket_id = 'submission-files'")).length, 0))
})
await t('post images: only into your own folder', async () => {
  await as(S1, async () => {
    await q("insert into storage.objects (bucket_id, name) values ('post-images', $1)", [`${S1}/pic.png`])
    await rejects(q("insert into storage.objects (bucket_id, name) values ('post-images', $1)", [`${S2}/pic.png`]), RLS)
  })
})
await t('buckets are private with size and type limits', async () => {
  const b = await q('select id, public, file_size_limit from storage.buckets order by id')
  assert.deepEqual(b.map((x) => x.id), ['class-files', 'post-images', 'submission-files'])
  assert.ok(b.every((x) => x.public === false))
  assert.equal(Number(b.find((x) => x.id === 'post-images').file_size_limit), 5242880)
})
await t('removing a student from a class removes their access', async () => {
  await as(T1, async () => assert.equal(await affected('delete from enrollments where class_id = $1 and user_id = $2', [CLS, S2]), 1))
  await as(S2, async () => { assert.equal((await q('select * from classes')).length, 0); assert.equal((await q('select * from assignments')).length, 0) })
  await as(S1, async () => assert.equal(await affected('delete from enrollments where class_id = $1 and user_id = $2', [CLS, S3]), 0, 'a student cannot remove classmates'))
})

await t('account deletion: removes the user and their data, only their own, and not for signed-out visitors', async () => {
  await as(S9, async () => {
    await q("insert into posts (author_id, body) values ($1, 'ivan post')", [S9])
    await q('select delete_my_account()')
  })
  assert.equal((await q('select * from profiles where id = $1', [S9])).length, 0)
  assert.equal((await q('select * from auth.users where id = $1', [S9])).length, 0)
  assert.equal((await q("select * from posts where author_id = $1", [S9])).length, 0, 'their posts are gone')
  assert.equal((await q('select * from profiles where id = $1', [S1])).length, 1, 'other users are untouched')
  await asAnon(async () => await rejects(q('select delete_my_account()'), /permission denied/))
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
  await db.exec('set role authenticated')
  await rejects(q('select delete_my_account()'), /Not signed in/)
  await db.exec('reset role')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
