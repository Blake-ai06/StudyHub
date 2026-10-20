import { launch, startServer } from './lib.mjs'
const server = await startServer(); const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })
await page.goto(server.url + '/install', { waitUntil: 'networkidle0' })
await page.screenshot({ path: new URL('./shots/install-390.png', import.meta.url).pathname, fullPage: true })
await browser.close(); server.stop()
