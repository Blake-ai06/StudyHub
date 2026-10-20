import fs from 'node:fs'
import { launch, sleep, startServer } from './lib.mjs'
import { createMock, ME, QUIZ, QUIZ_ONLINE_ONLY } from './mock-supabase.mjs'

const shots = new URL('./shots/', import.meta.url).pathname
fs.mkdirSync(shots, { recursive: true })
const CLASS_ID = '10000000-0000-4000-8000-000000000001', ASSIGN_ID = '20000000-0000-4000-8000-000000000001'
let failures = 0
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ->  ' + detail}`) }

const mock = createMock()
const server = await startServer()
const browser = await launch()
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 200)))
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
const cspSeen = []
// The page's own violation event is the detector (puppeteer's console event misses CSP reports). A second CDP Log session was tried
// and it interfered with page.setOfflineMode across reloads, so it is deliberately not used in this long offline flow (see csp-check.mjs).
await page.exposeFunction('__reportCsp', (m) => cspSeen.push(m))
await page.evaluateOnNewDocument(() => document.addEventListener('securitypolicyviolation', (e) => window.__reportCsp(`${e.violatedDirective} blocked ${e.blockedURI || '(inline/eval)'} at ${(e.sourceFile || '').split('/').pop()}:${e.lineNumber}`)))
await mock.install(page)

// ---------- 0. production headers ----------
{
  const get = async (p) => (await fetch(server.url + p)).headers
  const root = await get('/'), sw = await get('/sw.js'), man = await get('/manifest.webmanifest'), deep = await get('/app/classes/123')
  const asset = await (await fetch(server.url + '/')).text().then((h) => h.match(/\/assets\/[^"']+\.js/)?.[0])
  const assetH = asset ? await get(asset) : new Headers()
  check('CSP present, blocks inline scripts and other origins', /script-src 'self'(;|$)/.test(root.get('content-security-policy') ?? '') && /frame-ancestors 'none'/.test(root.get('content-security-policy') ?? ''))
  check('security headers present (HSTS, nosniff, referrer, permissions)', !!root.get('strict-transport-security') && root.get('x-content-type-options') === 'nosniff' && !!root.get('referrer-policy') && !!root.get('permissions-policy'))
  check('service worker file is never cached (so updates are found)', /no-cache|no-store/.test(sw.get('cache-control') ?? ''))
  check('hashed assets are cached for a year', /immutable/.test(assetH.get('cache-control') ?? '') && /max-age=31536000/.test(assetH.get('cache-control') ?? ''), assetH.get('cache-control') ?? 'no asset')
  check('manifest has the right content type', (man.get('content-type') ?? '').includes('application/manifest+json'))
  check('deep links fall back to the app (single-page rewrite)', (deep.get('content-type') ?? '').includes('text/html'))
}

const text = (t, timeout = 15000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t)
const clickText = async (t) => {
  await page.waitForFunction((x) => [...document.querySelectorAll('button, a')].some((e) => e.textContent.trim() === x), { timeout: 15000 }, t).catch(async () => { await page.screenshot({ path: shots + 'debug-missing-button.png' }); throw new Error('no button: ' + t + ' (see shots/debug-missing-button.png)') })
  await page.evaluate((x) => [...document.querySelectorAll('button, a')].find((e) => e.textContent.trim() === x).click(), t)
}
const pill = () => page.$eval('a[aria-label^="Connection status"]', (e) => e.getAttribute('aria-label')).catch(() => '')
const waitPill = (s, timeout = 15000) => page.waitForFunction((x) => [...document.querySelectorAll('a[aria-label^="Connection status"]')].some((e) => e.getAttribute('aria-label').includes(x)), { timeout }, s)
const idb = (store) => page.evaluate((s) => new Promise((res) => { const r = indexedDB.open('studyhub'); r.onsuccess = () => { try { const q = r.result.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result) } catch { res([]) } }; r.onerror = () => res([]) }), store)
const syncAndWait = async (expected) => {
  // "Sync now" is disabled while a connection check is running, so click again until the expected result shows up.
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Sync now'); if (b && !b.disabled) b.click() })
    const ok = await page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: 2500 }, expected).then(() => true).catch(() => false)
    if (ok) return
  }
  await page.screenshot({ path: shots + 'debug-sync.png' }); throw new Error('Sync now never showed: ' + expected)
}
const compose = async (body) => { await page.click('#post-body'); await page.type('#post-body', body) }
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

// ---------- 1. log in through the real login form ----------
await page.goto(server.url + '/login', { waitUntil: 'networkidle0' })
await page.type('#identifier', 'student@test.dev'); await page.type('#password', 'wrong-password')
await clickText('Log In')
await text('Incorrect email or password.')
check('wrong password shows a clear error', true)
await page.evaluate(() => { document.querySelector('#password').value = '' })
await page.click('#password', { clickCount: 3 }); await page.type('#password', 'password1')
await clickText('Log In')
await page.waitForFunction(() => location.pathname === '/app', { timeout: 15000 })
await text('Anyone want to form a study group for finals?')
check('login works and the feed shows posts from the server', true)

// ---------- 2. service worker ----------
await page.evaluate(() => navigator.serviceWorker.ready)
const swCount = await page.evaluate(async () => (await caches.keys()).length)
check('service worker active with a precache', swCount > 0, `caches=${swCount}`)
const swCaches = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out })
check('private API / storage responses are NOT in the service worker cache', !swCaches.some((u) => u.includes('supabase.co')), swCaches.filter((u) => u.includes('supabase')).join(','))

// ---------- 3. layout of the signed-in app at several widths ----------
const routes = ['/app', '/app/classes', `/app/classes/${CLASS_ID}`, `/app/classes/${CLASS_ID}/assignments/${ASSIGN_ID}`, '/app/people', '/app/notifications', '/app/bookmarks', '/app/messages', '/app/offline', '/app/me', '/app/create']
let overflowBad = 0
for (const w of [320, 390, 768, 1366]) {
  await page.setViewport({ width: w, height: w < 700 ? 800 : 900 })
  for (const r of routes) {
    await page.goto(server.url + r, { waitUntil: 'networkidle0' })
    await sleep(250)
    const o = await overflow()
    if (o > 0) { overflowBad++; console.log(`  overflow ${o}px at ${r} ${w}px`) }
    if (w === 390 && ['/app', `/app/classes/${CLASS_ID}`, '/app/offline', `/app/classes/${CLASS_ID}/assignments/${ASSIGN_ID}`].includes(r)) await page.screenshot({ path: `${shots}app-${r === '/app' ? 'feed' : r.includes('assignments') ? 'assignment' : r.includes('classes') ? 'class' : 'offline'}-390.png` })
    if (w === 1366 && r === '/app') await page.screenshot({ path: `${shots}app-feed-1366.png` })
    if (w === 768 && r === '/app') await page.screenshot({ path: `${shots}app-feed-768.png` })
  }
}
check('no horizontal scrolling on 11 app pages at 320/390/768/1366px', overflowBad === 0, `${overflowBad} pages`)
const nav = async (w) => { await page.setViewport({ width: w, height: 900 }); await page.goto(server.url + '/app', { waitUntil: 'networkidle0' }); return page.evaluate(() => { const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; const a = document.querySelector('aside'); return { sidebar: vis(a), sidebarW: a ? Math.round(a.getBoundingClientRect().width) : 0, bottom: vis(document.querySelector('nav[aria-label="Primary"]')) } }) }
const n390 = await nav(390), n768 = await nav(768), n1366 = await nav(1366)
check('phone: bottom navigation, no sidebar', n390.bottom && !n390.sidebar, JSON.stringify(n390))
check('tablet: compact icon sidebar (64px), no bottom nav', n768.sidebar && n768.sidebarW === 64 && !n768.bottom, JSON.stringify(n768))
check('laptop: full sidebar (256px), no bottom nav', n1366.sidebar && n1366.sidebarW === 256 && !n1366.bottom, JSON.stringify(n1366))
await page.setViewport({ width: 390, height: 844 })

// ---------- 4. warm the offline cache, then post online ----------
for (const r of ['/app', '/app/classes', `/app/classes/${CLASS_ID}`, `/app/classes/${CLASS_ID}?tab=assignments`]) { await page.goto(server.url + r, { waitUntil: 'networkidle0' }); await sleep(300) }
await page.goto(server.url + '/app', { waitUntil: 'networkidle0' })
await compose('Hello from the online test')
await clickText('Post')
await text('Hello from the online test')
check('online post is sent once and appears in the feed', mock.count('posts', (r) => r.body === 'Hello from the online test') === 1)

// ---------- 5. real offline: queue, reload offline, come back ----------
await page.setOfflineMode(true)
await waitPill('Offline')
check('status pill switches to Offline', (await pill()).includes('Offline'), await pill())
await compose('Written while offline')
await clickText('Post')
await text('Saved on this device')
check('offline post is saved locally with an honest "not published yet" message', true)
check('nothing reached the server while offline', mock.count('posts', (r) => r.body === 'Written while offline') === 0)
check('operation is persisted in IndexedDB', (await idb('outbox')).length === 1, String((await idb('outbox')).length))
await page.reload({ waitUntil: 'domcontentloaded' })
await text('Anyone want to form a study group for finals?', 20000)
check('app opens from the service worker while offline, showing cached feed', true)
{ const rows = await idb('outbox'); check('pending item survives the reload', rows.length === 1, JSON.stringify(rows.map((r) => ({ id: r.id, status: r.status, attempts: r.attempts, err: r.lastError, label: r.label })))+ ' sentToServer=' + mock.count('posts', (r) => r.body === 'Written while offline') + ' onLine=' + (await page.evaluate(() => navigator.onLine)) + ' url=' + page.url() + ' dbs=' + JSON.stringify(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name + '@' + d.version)))) }
await page.goto(server.url + '/app/offline', { waitUntil: 'domcontentloaded' })
await text('Written while offline')
check('Offline & sync page lists the pending post', true)
await page.screenshot({ path: `${shots}offline-while-offline-390.png` })
await page.goto(server.url + `/app/classes/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
await text('Math 101'); await text('Welcome to Math 101!')
check('a class opened earlier is readable offline', true)
await page.setOfflineMode(false)
await page.waitForFunction(() => true)
for (let i = 0; i < 40 && mock.count('posts', (r) => r.body === 'Written while offline') < 1; i++) await sleep(500)
check('queued post is delivered automatically when the connection returns', mock.count('posts', (r) => r.body === 'Written while offline') === 1)
await sleep(500)
check('outbox is empty after the server confirmed', (await idb('outbox')).length === 0)
await waitPill('Online'); check('status pill returns to Online', true)

// ---------- 6. lost response: server applied the write but the client never heard back ----------
await page.goto(server.url + '/app', { waitUntil: 'networkidle0' })
mock.state.dropResponses = 1
await compose('Retry me')
await clickText('Post')
await text('Saved on this device')
check('lost response is queued instead of being reported as a failure', (await idb('outbox')).length === 1)
await page.goto(server.url + '/app/offline', { waitUntil: 'networkidle0' })
await syncAndWait('Sync finished')
await sleep(300)
check('retry does not create a duplicate post', mock.state.db.posts.filter((p) => p.body === 'Retry me').length === 1, String(mock.state.db.posts.filter((p) => p.body === 'Retry me').length))
check('outbox cleared after the duplicate was recognised', (await idb('outbox')).length === 0)

// ---------- 7. browser says online, server is unreachable ----------
await page.goto(server.url + '/app', { waitUntil: 'networkidle0' })
mock.state.unreachable = true
await compose('Server is down')
await clickText('Post')
await text('Saved on this device')
check('server-down post is queued even though navigator.onLine is true', (await idb('outbox')).length === 1 && (await page.evaluate(() => navigator.onLine)))
await page.goto(server.url + '/app/offline', { waitUntil: 'networkidle0' })
await syncAndWait('cannot be reached')
check('Sync now reports the server is unreachable instead of pretending', true)
await waitPill('Offline'); check('pill shows Offline although the browser reports online', true)
mock.state.unreachable = false
await syncAndWait('Sync finished')
await sleep(300)
check('queued post is delivered once the server is back', mock.state.db.posts.filter((p) => p.body === 'Server is down').length === 1)

// ---------- 8. drafts survive a refresh ----------
await page.goto(server.url + '/app', { waitUntil: 'networkidle0' })
await compose('half written thought'); await sleep(900)
await page.reload({ waitUntil: 'networkidle0' })
const restored = await page.$eval('#post-body', (e) => e.value).catch(() => '')
check('unsent post text is restored after a refresh', restored === 'half written thought', restored)


// ---------- 8b. installing the app: permanent options even after the reminder is closed ----------
const sendInstallOffer = () => page.evaluate(() => { const ev = new Event('beforeinstallprompt', { cancelable: true }); ev.prompt = async () => { window.__prompted = (window.__prompted || 0) + 1 }; ev.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(ev) })
const hasText = (t) => page.evaluate((x) => document.body.innerText.includes(x), t)
await page.setViewport({ width: 1366, height: 900 })
await page.goto(server.url + '/app/classes', { waitUntil: 'networkidle0' })
check('app menu has a permanent "Install app" item', await page.evaluate(() => [...document.querySelectorAll('aside a')].some((a) => a.getAttribute('aria-label') === 'Install app')))
await sendInstallOffer()
await text('Install StudyHub on this device.')
check('install reminder appears when the browser offers installation', true)
await page.evaluate(() => document.querySelector('button[aria-label="Hide the install reminder for a week"]').click())
await sleep(300)
check('the X hides the reminder', !(await hasText('Install StudyHub on this device.')))
await page.reload({ waitUntil: 'networkidle0' }); await sendInstallOffer(); await sleep(500)
check('the reminder stays hidden after a reload (snoozed for a week)', !(await hasText('Install StudyHub on this device.')))
await page.goto(server.url + '/app/install', { waitUntil: 'networkidle0' }); await sendInstallOffer()
await text('Windows, Mac, or Chromebook')
check('Install page lists steps for phones and computers', (await hasText('Android phone or tablet')) && (await hasText('iPhone or iPad')))
await clickText('Install StudyHub')
await sleep(300)
check('the Install button still works after the reminder was closed', (await page.evaluate(() => window.__prompted)) === 1)
await page.goto(server.url + '/install', { waitUntil: 'networkidle0' })
await text('Get the StudyHub app')
check('public /install page works without logging in context', true)
await page.goto(server.url + '/', { waitUntil: 'networkidle0' })
check('landing page footer links to "Get the app"', await page.evaluate(() => [...document.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Get the app' && a.getAttribute('href') === '/install')))
await page.setViewport({ width: 390, height: 844 })
await page.goto(server.url + '/app/me', { waitUntil: 'networkidle0' })
check('Profile page has an install shortcut on phones', await page.evaluate(() => [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/app/install')))
const manifest = await (await fetch(server.url + '/manifest.webmanifest')).json()
check('manifest is installable (id, standalone, 192 + 512 + maskable icons, shortcuts)', manifest.id === '/' && manifest.display === 'standalone' && ['192x192', '512x512'].every((z) => manifest.icons.some((i) => i.sizes === z)) && manifest.icons.some((i) => i.purpose === 'maskable') && manifest.shortcuts?.length === 3)

// ---------- 9. assignment: submit offline, sync, server confirms ----------
await page.goto(server.url + `/app/classes/${CLASS_ID}/assignments/${ASSIGN_ID}`, { waitUntil: 'networkidle0' })
await page.setOfflineMode(true); await waitPill('Offline')
await page.click('#sb'); await page.type('#sb', 'My answers: 1) 4  2) 9')
await clickText('Submit')
await text('Waiting to sync')
check('offline submission says it is NOT officially submitted yet', (await page.evaluate(() => document.body.innerText)).includes('not officially submitted'))
check('server has no submission yet', mock.state.db.submissions.length === 0)
await page.setOfflineMode(false)
for (let i = 0; i < 40 && mock.state.db.submissions.length < 1; i++) await sleep(500)
check('submission delivered after reconnect', mock.state.db.submissions.length === 1 && mock.state.db.submissions[0].status === 'submitted', JSON.stringify(mock.state.db.submissions[0] ?? null))
await page.reload({ waitUntil: 'networkidle0' })
await text('Submitted')
check('student then sees the server-confirmed status', true)


// ---------- 9b. quizzes offline ----------
const pickAnswer = (label) => page.evaluate((l) => [...document.querySelectorAll('label')].find((x) => x.innerText.trim() === l).click(), label)
await page.goto(server.url + `/app/classes/${CLASS_ID}/quizzes/${QUIZ}`, { waitUntil: 'networkidle0' }) // open once online so it is cached
await text('Quiz 1 (offline allowed)')
await page.goto(server.url + `/app/classes/${CLASS_ID}/quizzes/${QUIZ_ONLINE_ONLY}`, { waitUntil: 'networkidle0' })
await page.setOfflineMode(true); await waitPill('Offline')
await page.reload({ waitUntil: 'domcontentloaded' })
await text('Quiz 2 (online only)', 20000)
await text('You are offline. Reconnect to start this quiz.')
check('a quiz that is not marked offline cannot be started offline', await page.$eval('button.rounded-full.bg-brand', (b) => b.disabled).catch(() => false))
await page.goto(server.url + `/app/classes/${CLASS_ID}/quizzes/${QUIZ}`, { waitUntil: 'domcontentloaded' })
await text('Offline attempts are allowed', 20000)
await clickText('Start quiz')
await text('What is 3 x 3?')
await pickAnswer('4'); await pickAnswer('9')
await sleep(4000) // let the clock run so a reset would be visible
await page.reload({ waitUntil: 'domcontentloaded' })
await text('What is 3 x 3?', 20000)
const checked = await page.$$eval('input[type=radio]:checked', (els) => els.length)
check('quiz answers and attempt survive a refresh mid-quiz', checked === 2, String(checked))
const timer = await page.$eval('[role=timer]', (e) => e.getAttribute('aria-label')).catch(() => '')
check('timer continues from the saved start time instead of resetting', /Time left 9:(5[0-6])/.test(timer), timer)
page.once('dialog', (d) => d.accept())
await clickText('Submit quiz')
await text('Waiting to sync')
check('offline quiz attempt is held as "waiting to sync", not counted yet', mock.state.db.quiz_attempts.length === 0)
await page.setOfflineMode(false)
for (let i = 0; i < 40 && mock.state.db.quiz_attempts.length < 1; i++) await sleep(500)
check('quiz attempt reaches the server after reconnect and is scored there', mock.state.db.quiz_attempts.length === 1 && mock.state.db.quiz_attempts[0].score === 5, JSON.stringify(mock.state.db.quiz_attempts))
await page.reload({ waitUntil: 'networkidle0' })
await text('Your score')
check('student sees the server-computed score', (await page.evaluate(() => document.body.innerText)).includes('5/5'))

// ---------- 10. log out with unsynced work ----------
await page.goto(server.url + '/app', { waitUntil: 'networkidle0' })
mock.state.unreachable = true
await compose('Pending at logout'); await clickText('Post'); await text('Saved on this device')
await page.goto(server.url + '/app/me', { waitUntil: 'networkidle0' }) // server stays unreachable, so the post stays unsynced
let dialogMsg = ''
page.once('dialog', async (d) => { dialogMsg = d.message(); await d.accept() })
await clickText('Log out')
await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000 })
check('log out warns about unsynced changes', /not synced yet/.test(dialogMsg), dialogMsg)
const left = { outbox: (await idb('outbox')).length, cache: (await idb('cache')).length, drafts: (await idb('drafts')).length, downloads: (await idb('downloads')).length }
check('log out works even while the server is unreachable', new URL(page.url()).pathname === '/login')
check('log out wipes private data from the device', Object.values(left).every((n) => n === 0), JSON.stringify(left))
await page.goto(server.url + '/app', { waitUntil: 'networkidle0' })
check('signed-out visitors are sent to the login page', new URL(page.url()).pathname === '/login')


// ---------- 11. privacy: delete my account ----------
mock.state.unreachable = false
await page.goto(server.url + '/login', { waitUntil: 'networkidle0' })
await page.type('#identifier', 'student@test.dev'); await page.type('#password', 'password1')
await clickText('Log In')
await page.waitForFunction(() => location.pathname === '/app', { timeout: 15000 })
await page.goto(server.url + '/app/me', { waitUntil: 'networkidle0' })
await text('Delete my account')
const delBtn = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete my account').disabled)
check('delete button is disabled until the username is typed', (await delBtn()) === true)
await page.type('#del', 'someone-else')
check('a wrong username keeps it disabled', (await delBtn()) === true)
await page.click('#del'); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.type('#del', 'jhamel')
await page.waitForFunction(() => ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete my account').disabled, { timeout: 3000 }).catch(() => {})
check('typing the exact username enables it', (await delBtn()) === false)
page.on('dialog', (d) => d.accept())
await clickText('Delete my account')
await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000 })
check('the server delete function was called, then the user is signed out', mock.state.rpcCalls.some((c) => c.fn === 'delete_my_account'))
check('no private data is left on the device after deletion', (await idb('outbox')).length + (await idb('cache')).length + (await idb('drafts')).length === 0)

check('no Content-Security-Policy violations anywhere in the whole flow', cspSeen.length === 0, cspSeen.slice(0, 3).join(' | '))
await browser.close(); server.stop()
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
