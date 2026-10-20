import { launch, startServer } from './lib.mjs'
const server = await startServer(); const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1536, height: 1024 })
await page.goto(server.url + '/', { waitUntil: 'networkidle0' })
await page.screenshot({ path: new URL('./shots/hero-1536.png', import.meta.url).pathname, clip: { x: 0, y: 0, width: 1536, height: 1024 } })
// measure headline lines vs column width at several widths
for (const w of [1024, 1100, 1280, 1366, 1536, 1920]) {
  await page.setViewport({ width: w, height: 900 })
  const r = await page.evaluate(() => { const h = document.querySelector('h1'); const col = h.parentElement; return { h1: h.scrollWidth, col: col.clientWidth, lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)) } })
  console.log(w, r, r.h1 > r.col ? 'CLIPPED' : 'fits')
}
await browser.close(); server.stop()
