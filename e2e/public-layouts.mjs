import fs from 'node:fs'
import { WIDTHS, heightFor, launch, startServer } from './lib.mjs'

const out = new URL('./shots/', import.meta.url).pathname
fs.mkdirSync(out, { recursive: true })
const server = await startServer()
const browser = await launch()
let bad = 0
for (const route of ['/', '/login', '/register', '/features', '/about', '/contact', '/privacy', '/terms', '/offline']) {
  for (const w of WIDTHS) {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: heightFor(w), deviceScaleFactor: 1 })
    await page.goto(server.url + route, { waitUntil: 'networkidle0' })
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    const overflow = m.sw > m.iw
    if (overflow) bad++
    console.log(`${overflow ? 'OVERFLOW' : 'ok      '} ${route.padEnd(10)} ${String(w).padStart(4)}px  scrollWidth=${m.sw}`)
    if ([375, 768, 1366].includes(w) && ['/', '/login'].includes(route)) await page.screenshot({ path: `${out}${route === '/' ? 'landing' : route.slice(1)}-${w}.png`, fullPage: route === '/' })
    await page.close()
  }
}
await browser.close(); server.stop()
console.log(bad ? `\n${bad} page/width combinations scroll sideways` : '\nNo horizontal scrolling at any tested width')
process.exit(bad ? 1 : 0)
