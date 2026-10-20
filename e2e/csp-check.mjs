// Visits pages and exercises form validation, then reports every Content-Security-Policy violation the browser raised.
// Uses two independent detectors (the page's own violation event and the browser's log) because puppeteer's console event misses these.
import { launch, startServer } from './lib.mjs'

const server = await startServer()
const browser = await launch()
const page = await browser.newPage()
const seen = []
await page.exposeFunction('__reportCsp', (m) => seen.push('event: ' + m))
await page.evaluateOnNewDocument(() => document.addEventListener('securitypolicyviolation', (e) => window.__reportCsp(`${e.violatedDirective} blocked ${e.blockedURI || '(inline/eval)'} at ${(e.sourceFile || '').split('/').pop()}:${e.lineNumber}`)))
const cdp = await page.createCDPSession()
await cdp.send('Log.enable')
cdp.on('Log.entryAdded', ({ entry }) => { if (entry.source === 'security' || /Content Security Policy|Refused to/i.test(entry.text)) seen.push('log: ' + entry.text.slice(0, 140)) })

for (const route of ['/', '/login', '/register', '/forgot-password', '/contact']) {
  await page.goto(server.url + route, { waitUntil: 'networkidle0' })
  // trigger form validation (this is where zod runs)
  await page.evaluate(() => [...document.querySelectorAll('button[type=submit], form button')].find((b) => /log in|create account|send reset link|send message/i.test(b.textContent))?.click())
  await new Promise((r) => setTimeout(r, 600))
}
await browser.close(); server.stop()
const unique = [...new Set(seen)]
console.log(unique.length ? `${unique.length} CSP violation(s):\n  - ` + unique.join('\n  - ') : 'No Content-Security-Policy violations')
process.exit(unique.length ? 1 : 0)
