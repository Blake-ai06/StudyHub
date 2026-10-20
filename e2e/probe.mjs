import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
const path = await chromium.executablePath()
console.log('exe', path)
const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: path, headless: 'shell' })
const page = await browser.newPage()
await page.setContent('<h1 style="font-family:sans-serif">hello</h1>')
console.log('title ok', await page.evaluate(() => document.querySelector('h1').textContent), await browser.version())
await browser.close()
