// Build da landing: junta HTML + CSS + JS (esbuild), gera os gráficos SVG, o JSON-LD do
// FAQ a partir do próprio HTML, e copia os arquivos estáticos para dist/.
import { build } from 'esbuild'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { articleJsonLd, checkFact, esc, hubHtml, loadFacts, loadPages, renderArticle, usedFactIds } from './aprender.mjs'
import {
    ARCHIVE_DATA_PATH,
    archiveTeaser,
    gameJsonLd,
    gameMeta,
    gamePath,
    indexJsonLd,
    indexMeta,
    loadArchive,
    renderGame,
    renderIndex,
} from './diarioArquivo.mjs'
import { heroSparkSvg, trailSvg } from './svg.mjs'

const SITE_URL = (process.env.SITE_URL || 'https://selucra.com.br').replace(/\/$/, '')
const APP_URL = (process.env.APP_URL || 'https://app.selucra.com.br').replace(/\/$/, '')
// API do Diário (jogo público na página /diario/). A CSP libera esta origem na DI.3.3.
const API_URL = (process.env.API_URL || 'https://api.selucra.com.br').replace(/\/$/, '')

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
    apiUrl = API_URL,
    outDir = 'dist',
    now = new Date(),
    analyticsToken = process.env.CF_ANALYTICS_TOKEN,
    // Jogos já encerrados do Diário (DI.3.4). Sem este parâmetro o build os busca na API; os testes
    // passam a lista pronta para não depender de rede.
    archive,
} = {}) {
    // Lê o arquivo ANTES de apagar o dist: o fallback é o `jogos.json` do deploy anterior, publicado no site.
    const archiveGames = archive ?? (await loadArchive({ apiUrl, siteUrl, now })).games
    await rm(outDir, { recursive: true, force: true })
    await mkdir(`${outDir}/assets`, { recursive: true })

    const result = await build({
        entryPoints: ['src/main.js', 'src/diario-page.ts', 'src/styles.css'],
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
    const diarioJs = outputs.find((o) => /\/diario-page-[^/]+\.js$/.test(o))
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
    const article = (meta, body, ld, ogType, pageJs = '', ogImage = 'og-image.png') =>
        fill(articleTpl)
            .replace('{{PAGE_JS}}', pageJs)
            .replace('{{HEADER}}', fill(header))
            .replace('{{FOOTER}}', fill(footer))
            .replaceAll('{{PAGE_TITLE}}', esc(meta.title))
            .replaceAll('{{PAGE_DESC}}', esc(meta.description))
            .replaceAll('{{PAGE_URL}}', meta.url)
            .replace('{{OG_TYPE}}', ogType)
            .replaceAll('{{OG_IMAGE}}', ogImage)
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

    // Diário Selucra: conteúdo para busca no HTML; o jogo é montado pelo bundle próprio (sem a cena 3D).
    const diarioUrl = `${siteUrl}/diario/`
    const diarioMeta = {
        title: 'Diário Selucra: jogo diário de finanças',
        description: 'Jogo diário de finanças com dois desafios: a palavra do mercado e uma pergunta de economia. Jogue sem login.',
        url: diarioUrl,
    }
    const diarioBody = (await readFile('src/diario.html', 'utf8'))
        .replaceAll('{{API_URL}}', apiUrl)
        .replaceAll('{{APP_URL}}', appUrl)
        .replaceAll('{{SITE_URL}}', siteUrl)
        .replace('{{GUIDE_SLUGS}}', pages.map((p) => p.slug).join(','))
        .replace('{{ARQUIVO}}', archiveTeaser(archiveGames))
    const diarioLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebApplication',
                '@id': `${diarioUrl}#app`,
                name: 'Diário Selucra',
                url: diarioUrl,
                description: diarioMeta.description,
                applicationCategory: 'GameApplication',
                genre: 'Educação financeira',
                operatingSystem: 'Web',
                browserRequirements: 'Requer JavaScript',
                inLanguage: 'pt-BR',
                publisher: { '@type': 'Organization', name: 'Selucra', url: `${siteUrl}/` },
            },
            { '@type': 'FAQPage', mainEntity: faqFromHtml(diarioBody) },
        ],
    })
    await writePage(
        'diario',
        article(diarioMeta, diarioBody, diarioLd, 'website', `<script type="module" src="${rel(diarioJs)}"></script>`, 'og-diario.png'),
    )
    urls.splice(2, 0, { loc: diarioUrl, priority: '0.9' })

    // Arquivo do Diário (DI.3.4): só existe quando há jogo encerrado (índice vazio seria página fina).
    const guideSlugs = new Set(pages.map((p) => p.slug))
    if (archiveGames.length > 0) {
        const idxMeta = indexMeta(siteUrl, archiveGames.length)
        await writePage(
            'diario/arquivo',
            article(idxMeta, renderIndex(archiveGames), indexJsonLd(archiveGames, { siteUrl }), 'website', '', 'og-diario.png'),
        )
        urls.splice(3, 0, { loc: idxMeta.url, lastmod: archiveGames[0].date, priority: '0.7' })
        for (const [i, g] of archiveGames.entries()) {
            // A lista vem do mais recente ao mais antigo: o vizinho "anterior" é o próximo item.
            const body = renderGame(g, { guideSlugs, appUrl, prev: archiveGames[i + 1], next: archiveGames[i - 1] })
            const ld = gameJsonLd(g, { siteUrl })
            await writePage(`diario/arquivo/${g.number}`, article(gameMeta(g, siteUrl), body, ld, 'article', '', 'og-diario.png'))
        }
        for (const g of archiveGames) urls.push({ loc: gameMeta(g, siteUrl).url, lastmod: g.date, priority: '0.6' })
        // O dado do arquivo vai junto: se a API estiver fora no próximo build, ele serve de base.
        await writeFile(`${outDir}/${ARCHIVE_DATA_PATH}`, JSON.stringify({ games: archiveGames }))
    }

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
    // A CSP libera só a origem da API do Diário (a mesma que a página chama).
    const headers = (await readFile(`${outDir}/_headers`, 'utf8')).replaceAll('{{API_URL}}', apiUrl)
    await writeFile(`${outDir}/_headers`, headers)
    const robots = (await readFile(`${outDir}/robots.txt`, 'utf8')).replaceAll('{{SITE_URL}}', siteUrl)
    await writeFile(`${outDir}/robots.txt`, robots)
    return { outDir, pages }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { outDir } = await buildLanding()
    console.log(`landing: ${outDir}/ pronto (${SITE_URL}, app em ${APP_URL})`)
}
