// Servidor local da landing: builda com URLs de localhost, serve dist/ e rebuilda ao salvar.
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { readFile, stat } from 'node:fs/promises'
import { watch } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { buildLanding } from './build.mjs'

const PORT = Number(process.env.PORT || 4173)
const SITE = `http://localhost:${PORT}`
const APP = process.env.APP_URL || 'http://localhost:5173'
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.woff2': 'font/woff2',
}

async function rebuild() {
    try {
        await buildLanding({ siteUrl: SITE, appUrl: APP })
        console.log('landing: build ok')
    } catch (e) {
        console.error('landing: build falhou\n', e.message)
    }
}

await rebuild()
let timer
for (const dir of ['src', 'content']) {
    watch(dir, { recursive: true }, () => {
        clearTimeout(timer)
        timer = setTimeout(rebuild, 150)
    })
}

createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, SITE).pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join('dist', path)
    try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
        const type = TYPES[extname(file)] || 'application/octet-stream'
        let body = await readFile(file)
        const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' }
        // Comprime como o Cloudflare Pages faz, para medir o tamanho real que o visitante baixa.
        if (/gzip/.test(req.headers['accept-encoding'] || '') && /^(text|application|image\/svg)/.test(type)) {
            body = gzipSync(body)
            headers['Content-Encoding'] = 'gzip'
        }
        res.writeHead(200, headers)
        res.end(body)
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('404')
    }
}).listen(PORT, () => console.log(`landing: ${SITE}  (CTAs apontam para ${APP})`))
