// Build da landing: junta HTML + CSS + JS (esbuild), gera os gráficos SVG, o JSON-LD do
// FAQ a partir do próprio HTML, e copia os arquivos estáticos para dist/.
import { build } from 'esbuild'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { articleJsonLd, checkFact, esc, hubHtml, loadFacts, loadPages, renderArticle, usedFactIds } from './aprender.mjs'
import { heroSparkSvg, trailSvg } from './svg.mjs'

const SITE_URL = (process.env.SITE_URL || 'https://selucra.com.br').replace(/\/$/, '')
const APP_URL = (process.env.APP_URL || 'https://app.selucra.com.br').replace(/\/$/, '')

const decode = (s) =>
    s
        .replace(/&minus;/g, '−')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()

export function faqFromHtml(html) {
    const items = [...html.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)]
    return items.map((m) => ({
        '@type': 'Question',
        name: decode(m[1]),
        acceptedAnswer: { '@type': 'Answer', text: decode(m[2]) },
    }))
}

export function jsonLd(faq, siteUrl, appUrl) {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': `${siteUrl}/#org`,
                name: 'Selucra',
                url: `${siteUrl}/`,
                logo: `${siteUrl}/icon-512.png`,
            },
            {
                '@type': 'WebSite',
                '@id': `${siteUrl}/#site`,
                url: `${siteUrl}/`,
                name: 'Selucra',
                inLanguage: 'pt-BR',
                publisher: { '@id': `${siteUrl}/#org` },
            },
            {
                '@type': 'SoftwareApplication',
                name: 'Selucra',
                applicationCategory: 'EducationalApplication',
                operatingSystem: 'Web, Android, iOS (PWA)',
                url: appUrl,
                inLanguage: 'pt-BR',
                description:
                    'Simulador de investimentos para aprender renda fixa e renda variável com R$ 10.000 virtuais num mercado simulado.',
            },
            { '@type': 'FAQPage', mainEntity: faq },
        ],
    })
}

// Cloudflare Web Analytics: contagem de visitas e desempenho, sem cookies. Só entra se o token
// (32 caracteres hexadecimais, do painel da Cloudflare) vier de CF_ANALYTICS_TOKEN no build.
export function analyticsSnippet(token) {
    if (!token) return ''
    if (!/^[a-f0-9]{32}$/.test(token))
        throw new Error('CF_ANALYTICS_TOKEN inválido: esperado o token de 32 caracteres do Cloudflare Web Analytics')
    return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>`
}

export async function buildLanding({
    siteUrl = SITE_URL,
    appUrl = APP_URL,
    outDir = 'dist',
    now = new Date(),
    analyticsToken = process.env.CF_ANALYTICS_TOKEN,
} = {}) {
    await rm(outDir, { recursive: true, force: true })
    await mkdir(`${outDir}/assets`, { recursive: true })

    const result = await build({
        entryPoints: ['src/main.js', 'src/styles.css'],
        outdir: `${outDir}/assets`,
        entryNames: '[name]-[hash]',
        chunkNames: '[name]-[hash]',
        assetNames: '[name]-[hash]',
        bundle: true,
        splitting: true,
        format: 'esm',
        minify: true,
        target: 'es2020',
        loader: { '.woff2': 'file' },
        metafile: true,
        logLevel: 'warning',
    })
    const outputs = Object.keys(result.metafile.outputs)
    const rel = (p) => '/assets/' + p.split('/assets/')[1]
    const js = outputs.find((o) => /\/main-[^/]+\.js$/.test(o))
    const css = outputs.find((o) => /\/styles-[^/]+\.css$/.test(o))
    const fonts = outputs.filter((o) => o.endsWith('.woff2'))

    const preload = fonts.map((f) => `<link rel="preload" href="${rel(f)}" as="font" type="font/woff2" crossorigin />`).join('\n        ')
    const analytics = analyticsSnippet(analyticsToken)
    const fill = (t) =>
        t
            .replace('{{ANALYTICS}}', analytics)
            .replace('{{PRELOAD_FONTS}}', preload)
            .replace('{{CSS}}', `<link rel="stylesheet" href="${rel(css)}" />`)
            .replaceAll('{{SITE_URL}}', siteUrl)
            .replaceAll('{{APP_URL}}', appUrl)

    const source = await readFile('src/index.html', 'utf8')
    // Cabeçalho e rodapé dos guias são os da home, com os âncoras apontando para a home.
    const header = source.match(/<header class="nav">[\s\S]*?<\/header>/)[0].replaceAll('href="#', 'href="/#')
    const footer = source.match(/<footer>[\s\S]*?<\/footer>/)[0]
    const articleTpl = await readFile('src/article.html', 'utf8')

    // Guias: os fatos regulatórios precisam estar em página oficial e dentro do prazo.
    const [{ facts, maxAgeDays }, pages] = await Promise.all([loadFacts(), loadPages()])
    const summaries = pages.map((p) => ({ slug: p.slug, title: p.title, summary: p.summary, description: p.description }))
    for (const p of pages) {
        for (const id of [...p.facts, ...usedFactIds(p)]) {
            const f = facts.get(id)
            if (!f) throw new Error(`${p.slug}: fato desconhecido ${id}`)
            checkFact(f, now, maxAgeDays)
        }
        for (const id of usedFactIds(p))
            if (!p.facts.includes(id)) throw new Error(`${p.slug}: o fato ${id} é usado no texto mas não está em "facts" (Fontes)`)
    }

    let html = fill(source)
        .replace('{{JS}}', `<script type="module" src="${rel(js)}"></script>`)
        .replace('{{JSONLD}}', jsonLd(faqFromHtml(source), siteUrl, appUrl))
        .replace('{{SPARK_SVG}}', heroSparkSvg())
        .replace('{{TRAIL_SVG}}', trailSvg())
    await writeFile(`${outDir}/index.html`, html)

    const urls = [{ loc: `${siteUrl}/`, priority: '1.0' }]
    const writePage = async (path, page) => {
        await mkdir(`${outDir}/${path}`, { recursive: true })
        await writeFile(`${outDir}/${path}/index.html`, page)
    }
    const article = (meta, body, ld, ogType) =>
        fill(articleTpl)
            .replace('{{HEADER}}', fill(header))
            .replace('{{FOOTER}}', fill(footer))
            .replaceAll('{{PAGE_TITLE}}', esc(meta.title))
            .replaceAll('{{PAGE_DESC}}', esc(meta.description))
            .replaceAll('{{PAGE_URL}}', meta.url)
            .replace('{{OG_TYPE}}', ogType)
            .replace('{{JSONLD}}', ld)
            .replace('{{BODY}}', body)
    for (const p of pages) {
        const url = `${siteUrl}/aprender/${p.slug}/`
        const body = renderArticle(p, { facts, all: summaries, appUrl })
        await writePage(`aprender/${p.slug}`, article({ ...p, url }, body, articleJsonLd(p, { siteUrl, facts }), 'article'))
        urls.push({ loc: url, lastmod: p.updated, priority: '0.8' })
    }
    const hubUrl = `${siteUrl}/aprender/`
    const hubMeta = {
        title: 'Guias para aprender a investir',
        description: 'Guias diretos sobre Selic, ETF e Tesouro Direto, com as regras conferidas em fonte oficial.',
        url: hubUrl,
    }
    const hubLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: hubMeta.title,
        url: hubUrl,
        inLanguage: 'pt-BR',
    })
    await writePage('aprender', article(hubMeta, hubHtml(summaries), hubLd, 'website'))
    urls.splice(1, 0, { loc: hubUrl, priority: '0.9' })

    await cp('src/static', outDir, { recursive: true })
    const sitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls
            .map(
                (u) =>
                    `    <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
            )
            .join('\n') +
        '\n</urlset>\n'
    await writeFile(`${outDir}/sitemap.xml`, sitemap)
    const robots = (await readFile(`${outDir}/robots.txt`, 'utf8')).replaceAll('{{SITE_URL}}', siteUrl)
    await writeFile(`${outDir}/robots.txt`, robots)
    return { outDir, pages }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { outDir } = await buildLanding()
    console.log(`landing: ${outDir}/ pronto (${SITE_URL}, app em ${APP_URL})`)
}
