// A small in-memory stand-in for Supabase (Auth + REST + Storage), used to drive the real app in a real browser.
// It is NOT the real database: it cannot check Row Level Security. See ../supabase/tests for that.
export const ORIGIN = 'https://txrqtghrmsnjbgfybahs.supabase.co'
export const ME = '00000000-0000-4000-8000-000000000001'
export const TEACHER = '00000000-0000-4000-8000-000000000002'
export const PEER = '00000000-0000-4000-8000-000000000003'
const CLASS = '10000000-0000-4000-8000-000000000001'
const ASSIGN = '20000000-0000-4000-8000-000000000001'
export const QUIZ = '30000000-0000-4000-8000-000000000001'
export const QUIZ_ONLINE_ONLY = '30000000-0000-4000-8000-000000000002'
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString()
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub, exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp })}.sig`

export function createMock() {
  const state = {
    unreachable: false, // every request to Supabase is aborted (server down, but the browser thinks it is online)
    dropResponses: 0, // apply the next N writes on the "server", then lose the response
    failWrites: 0, // reject the next N writes with a network error without applying them
    writes: [], // log of every write that reached the server: { method, table, row }
    db: {
      profiles: [
        { id: ME, username: 'jhamel', full_name: 'Jhamel Student', role: 'student', avatar_url: null, bio: null },
        { id: TEACHER, username: 'ms_cruz', full_name: 'Maria Cruz', role: 'teacher', avatar_url: null, bio: null },
        { id: PEER, username: 'kiko', full_name: 'Kiko Reyes', role: 'student', avatar_url: null, bio: null },
      ],
      posts: [
        { id: 'p0000000-0000-4000-8000-000000000001', author_id: TEACHER, body: 'Chapter 3 quiz is on Friday. Review the practice set.', image_path: null, visibility: 'public', created_at: iso(-3_600_000) },
        { id: 'p0000000-0000-4000-8000-000000000002', author_id: PEER, body: 'Anyone want to form a study group for finals?', image_path: null, visibility: 'public', created_at: iso(-7_200_000) },
      ],
      comments: [], reactions: [], bookmarks: [], notifications: [], connections: [], messages: [], quiz_attempts: [],
      quizzes: [
        { id: QUIZ, class_id: CLASS, created_by: TEACHER, title: 'Quiz 1 (offline allowed)', description: null, due_at: iso(2 * 86_400_000), time_limit_min: 10, allow_offline: true, published: true, created_at: iso(-1000) },
        { id: QUIZ_ONLINE_ONLY, class_id: CLASS, created_by: TEACHER, title: 'Quiz 2 (online only)', description: null, due_at: iso(2 * 86_400_000), time_limit_min: null, allow_offline: false, published: true, created_at: iso(-2000) },
      ],
      quiz_questions: [
        { id: 'q1000000-0000-4000-8000-000000000001', quiz_id: QUIZ, prompt: 'What is 2 + 2?', points: 2, position: 1 },
        { id: 'q1000000-0000-4000-8000-000000000002', quiz_id: QUIZ, prompt: 'What is 3 x 3?', points: 3, position: 2 },
        { id: 'q1000000-0000-4000-8000-000000000003', quiz_id: QUIZ_ONLINE_ONLY, prompt: 'Capital of France?', points: 1, position: 1 },
      ],
      quiz_options: [
        { id: 'o1000000-0000-4000-8000-000000000001', question_id: 'q1000000-0000-4000-8000-000000000001', label: '4', position: 0 },
        { id: 'o1000000-0000-4000-8000-000000000002', question_id: 'q1000000-0000-4000-8000-000000000001', label: '5', position: 1 },
        { id: 'o1000000-0000-4000-8000-000000000003', question_id: 'q1000000-0000-4000-8000-000000000002', label: '9', position: 0 },
        { id: 'o1000000-0000-4000-8000-000000000004', question_id: 'q1000000-0000-4000-8000-000000000002', label: '6', position: 1 },
        { id: 'o1000000-0000-4000-8000-000000000005', question_id: 'q1000000-0000-4000-8000-000000000003', label: 'Paris', position: 0 },
        { id: 'o1000000-0000-4000-8000-000000000006', question_id: 'q1000000-0000-4000-8000-000000000003', label: 'Rome', position: 1 },
      ],
      classes: [{ id: CLASS, teacher_id: TEACHER, name: 'Math 101', section: 'Section A', description: 'Algebra and functions', join_code: 'ABCD1234', join_enabled: true, archived: false, created_at: iso(-86_400_000) }],
      enrollments: [{ class_id: CLASS, user_id: ME, joined_at: iso(-80_000_000) }],
      announcements: [{ id: 'a0000000-0000-4000-8000-000000000001', class_id: CLASS, author_id: TEACHER, body: 'Welcome to Math 101!', created_at: iso(-80_000_000) }],
      materials: [],
      assignments: [{ id: ASSIGN, class_id: CLASS, created_by: TEACHER, title: 'Problem Set 1', instructions: 'Solve problems 1 to 10.', due_at: iso(3 * 86_400_000), points: 100, created_at: iso(-80_000_000) }],
      submissions: [],
    },
  }
  const T = state.db
  const KEY = { 'q1000000-0000-4000-8000-000000000001': 'o1000000-0000-4000-8000-000000000001', 'q1000000-0000-4000-8000-000000000002': 'o1000000-0000-4000-8000-000000000003', 'q1000000-0000-4000-8000-000000000003': 'o1000000-0000-4000-8000-000000000005' }
  state.rpcCalls = []
  const withCors = (h = {}) => ({ 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', ...h })
  const json = (status, body, extra = {}) => ({ status, headers: withCors({ 'content-type': 'application/json', ...extra }), body: JSON.stringify(body) })

  function match(row, [key, raw]) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) return true
    const v = row[key]
    const [op, ...rest] = raw.split('.'); const arg = rest.join('.')
    if (op === 'eq') return String(v) === arg
    if (op === 'neq') return String(v) !== arg
    if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').includes(String(v))
    if (op === 'is') return arg === 'null' ? v == null : String(v) === arg
    if (op === 'not') return arg === 'is.null' ? v != null : true
    if (op === 'gte') return String(v) >= arg
    if (op === 'gt') return String(v) > arg
    if (op === 'lte') return String(v) <= arg
    if (op === 'lt') return String(v) < arg
    return true
  }
  const embed = (table, r) => {
    if (table === 'posts') return { ...r, author: T.profiles.find((p) => p.id === r.author_id), reactions: [{ count: T.reactions.filter((x) => x.post_id === r.id).length }], comments: [{ count: T.comments.filter((x) => x.post_id === r.id).length }] }
    if (table === 'classes') return { ...r, teacher: T.profiles.find((p) => p.id === r.teacher_id) }
    if (table === 'quiz_questions') return { ...r, options: T.quiz_options.filter((o) => o.question_id === r.id) }
    if (table === 'announcements') return { ...r, author: T.profiles.find((p) => p.id === r.author_id) }
    return r
  }

  function rest(req, url, table) {
    const method = req.method()
    const rows = (T[table] ??= [])
    const params = [...url.searchParams.entries()]
    if (method === 'GET' || method === 'HEAD') {
      let out = rows.filter((r) => params.every((p) => match(r, p)))
      const order = url.searchParams.get('order')
      if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : 1) * (dir === 'desc' ? -1 : 1)) }
      const lim = Number(url.searchParams.get('limit')); if (lim) out = out.slice(0, lim)
      const range = { 'content-range': `*/${out.length}` }
      if (method === 'HEAD') return json(200, '', range)
      const shaped = out.map((r) => embed(table, r))
      if ((req.headers().accept ?? '').includes('vnd.pgrst.object')) return shaped[0] ? json(200, shaped[0], range) : json(406, { code: 'PGRST116', message: 'no rows' })
      return json(200, shaped, range)
    }
    if (method === 'POST') {
      let body; try { body = JSON.parse(req.postData() ?? 'null') } catch { body = null }
      const list = Array.isArray(body) ? body : [body]
      const upsert = (req.headers().prefer ?? '').includes('merge-duplicates')
      const conflict = url.searchParams.get('on_conflict')?.split(',')
      const saved = []
      for (const row of list) {
        const key = conflict ? conflict.every((c) => true) : null
        const existing = conflict ? rows.find((r) => conflict.every((c) => String(r[c]) === String(row[c]))) : rows.find((r) => row.id && r.id === row.id)
        if (existing && !upsert) return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
        if (existing) { Object.assign(existing, row, { id: existing.id }); saved.push(existing); continue }
        const full = { created_at: iso(), updated_at: iso(), ...(table === 'submissions' ? { status: 'draft', submitted_at: null, grade: null, feedback: null, graded_at: null } : {}), ...row }
        if (table === 'submissions' && full.status === 'submitted') full.submitted_at = iso()
        rows.push(full); saved.push(full); void key
      }
      saved.forEach((row) => state.writes.push({ method: 'POST', table, row }))
      const wantsBody = (req.headers().prefer ?? '').includes('return=representation')
      return json(201, wantsBody ? (Array.isArray(body) ? saved : saved[0]) : '')
    }
    if (method === 'PATCH' || method === 'DELETE') {
      const hit = rows.filter((r) => params.every((p) => match(r, p)))
      if (method === 'DELETE') hit.forEach((r) => rows.splice(rows.indexOf(r), 1))
      else { const body = JSON.parse(req.postData() ?? '{}'); hit.forEach((r) => Object.assign(r, body, { updated_at: iso() })) }
      hit.forEach((row) => state.writes.push({ method, table, row }))
      return json(204, '')
    }
    return json(405, { message: 'method not allowed' })
  }

  async function handle(req) {
    const url = new URL(req.url())
    const method = req.method()
    if (method === 'OPTIONS') return { status: 204, headers: withCors({ 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-max-age': '600' }) }
    const p = url.pathname
    if (p === '/auth/v1/health') return json(200, { status: 'ok' })
    if (p === '/auth/v1/token') {
      const body = JSON.parse(req.postData() ?? '{}')
      if (url.searchParams.get('grant_type') === 'password') {
        if (body.email !== 'student@test.dev' || body.password !== 'password1') return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' })
      }
      const exp = Math.floor(Date.now() / 1000) + 3600
      return json(200, { access_token: jwt(ME, exp), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-1', user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'student@test.dev', app_metadata: {}, user_metadata: {}, created_at: iso(-1e9) } })
    }
    if (p === '/auth/v1/logout') return json(204, '')
    if (p === '/auth/v1/user') return json(200, { id: ME, aud: 'authenticated', role: 'authenticated', email: 'student@test.dev', app_metadata: {}, user_metadata: {} })
    if (p === '/rest/v1/rpc/submit_quiz') {
      const b = JSON.parse(req.postData() ?? '{}')
      state.rpcCalls.push(b)
      const ex = T.quiz_attempts.find((a) => a.quiz_id === b.p_quiz_id && a.student_id === ME)
      if (ex) return json(200, { score: ex.score, max_score: ex.max_score, already: true })
      const qs = T.quiz_questions.filter((x) => x.quiz_id === b.p_quiz_id)
      const score = qs.reduce((n, x) => n + (b.p_answers[x.id] === KEY[x.id] ? x.points : 0), 0)
      const max = qs.reduce((n, x) => n + x.points, 0)
      T.quiz_attempts.push({ id: b.p_attempt_id, quiz_id: b.p_quiz_id, student_id: ME, submitted_at: iso(), score, max_score: max })
      state.writes.push({ method: 'RPC', table: 'quiz_attempts', row: { id: b.p_attempt_id } })
      return json(200, { score, max_score: max, already: false })
    }
    if (p.startsWith('/rest/v1/rpc/')) { state.rpcCalls.push({ fn: p.split('/').pop() }); return json(200, null) }
    if (p.startsWith('/rest/v1/')) return rest(req, url, p.slice('/rest/v1/'.length))
    if (p.startsWith('/storage/v1/')) return json(200, { Key: 'ok', signedURL: '/object/sign/x?token=t', path: 'x' })
    return json(404, { message: 'not mocked: ' + p })
  }

  async function install(page) {
    await page.setRequestInterception(true)
    page.on('request', async (req) => {
      if (!req.url().startsWith(ORIGIN)) return req.continue()
      if (state.unreachable) return req.abort('failed')
      const isWrite = ['POST', 'PATCH', 'DELETE'].includes(req.method()) && req.url().includes('/rest/v1/')
      if (isWrite && state.failWrites > 0) { state.failWrites--; return req.abort('failed') }
      try {
        const res = await handle(req)
        if (isWrite && state.dropResponses > 0) { state.dropResponses--; return req.abort('failed') } // server applied it, the client never hears back
        return req.respond(res)
      } catch (e) { return req.respond(json(500, { message: String(e) })) }
    })
  }
  const count = (table, pred) => state.writes.filter((w) => w.method === 'POST' && w.table === table && (!pred || pred(w.row))).length
  return { state, install, count }
}
