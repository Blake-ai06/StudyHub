// Serves dist/ exactly the way vercel.json says (headers + SPA rewrite), so tests see production behavior.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' }
const rules = config.headers.map((h) => ({ re: new RegExp('^' + h.source.replace(/\(\.\*\)/g, '.*').replace(/\//g, '\\/') + '$'), headers: h.headers }))

export function startProdServer(port = 4173) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.join(root, 'dist', urlPath)
    const safe = file.startsWith(path.join(root, 'dist'))
    let served = urlPath
    if (!safe || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { file = path.join(root, 'dist', 'index.html'); served = '/index.html' } // rewrite
    const headers = { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' }
    for (const r of rules) if (r.re.test(urlPath)) for (const h of r.headers) headers[h.key.toLowerCase()] = h.value
    if (served === '/index.html' && !headers['cache-control']) headers['cache-control'] = 'public, max-age=0, must-revalidate'
    res.writeHead(200, headers)
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(port, () => resolve({ url: `http://localhost:${port}`, stop: () => server.close() })))
}
