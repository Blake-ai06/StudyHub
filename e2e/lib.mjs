import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export { sleep }

import { startProdServer } from './serve-prod.mjs'

/** Serves the production build (dist/) with the same headers and rewrites as vercel.json. Set STUDYHUB_SERVER=vite to use vite preview instead. */
export async function startServer(port = 4173) {
  if (process.env.STUDYHUB_SERVER !== 'vite') return startProdServer(port)
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break } catch { /* not up yet */ }
    await sleep(250)
  }
  return { url: `http://localhost:${port}`, stop: () => proc.kill('SIGTERM') }
}

/** Uses CHROME_PATH (your installed Chrome/Edge) when set, otherwise the bundled Linux Chromium. */
export async function launch() {
  let executablePath = process.env.CHROME_PATH
  let args = ['--no-sandbox']
  if (!executablePath) {
    const { default: chromium } = await import('@sparticuz/chromium')
    executablePath = await chromium.executablePath()
    args = [...chromium.args, '--no-sandbox']
  }
  return puppeteer.launch({ executablePath, args, headless: 'shell' })
}

export const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1366, 1920]
export const heightFor = (w) => (w < 700 ? 800 : w < 1100 ? 1024 : 800)
