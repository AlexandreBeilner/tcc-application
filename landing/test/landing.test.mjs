import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { checkFact, inline, resolveFacts, resolvePage, usedFactIds } from '../aprender.mjs'
import { analyticsSnippet, buildLanding, faqFromHtml } from '../build.mjs'
import { sparklinePoints, trailPoints, TRAIL_MARKS } from '../svg.mjs'

const SITE = 'https://exemplo.test'
const APP = 'https://app.exemplo.test'

describe('landing buildada', () => {
    let dir
    let html
    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'landing-'))
        await buildLanding({ siteUrl: SITE, appUrl: APP, outDir: dir, archive: [] })
        html = await readFile(join(dir, 'index.html'), 'utf8')
    })
    after(() => rm(dir, { recursive: true, force: true }))

    it('tem um único h1 e o conteúdo do hero no HTML entregue (sem JS)', () => {
        assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1)
        assert.match(html, /Aprenda a investir <em>investindo<\/em>/)
        assert.match(html, /simulador de investimentos/i)
    })

    it('não deixa placeholder sem substituir', () => {
        assert.equal(html.match(/\{\{[A-Z_]+\}\}/g), null)
    })

    it('title e description dentro dos limites de SERP e sem falar de preço', () => {
        const title = html.match(/<title>(.*?)<\/title>/)[1]
        const desc = html.match(/name="description"\s+content="([^"]*)"/)[1]
        assert.ok(title.length <= 65, `title com ${title.length} caracteres`)
        assert.ok(desc.length >= 100 && desc.length <= 160, `description com ${desc.length} caracteres`)
        assert.doesNotMatch(html, /gr[áa]tis|sem cart[ãa]o|\bPRO\b|R\$ 19|assinatura/i)
    })

    it('os botões de criar conta abrem o cadastro; Entrar abre o login', () => {
        const signup = html.match(new RegExp(`href="${APP}/login\\?modo=cadastro"`, 'g')) ?? []
        assert.ok(signup.length >= 4, `só ${signup.length} links para o cadastro`)
        assert.match(html, new RegExp(`class="btn btn-ghost login" href="${APP}/login"`))
    })

    it('canonical e Open Graph usam a URL do site; CTAs vão para o app', () => {
        assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/"`))
        assert.match(html, new RegExp(`og:image" content="${SITE}/og-image.png"`))
        assert.match(html, new RegExp(`href="${APP}/login"`))
    })

    it('JSON-LD é válido e o FAQPage espelha as perguntas visíveis', () => {
        const raw = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]
        const graph = JSON.parse(raw)['@graph']
        const faq = graph.find((n) => n['@type'] === 'FAQPage')
        const visible = (html.match(/<summary>/g) ?? []).length
        assert.ok(visible >= 3)
        assert.equal(faq.mainEntity.length, visible)
        assert.deepEqual(faq.mainEntity, faqFromHtml(html))
        for (const t of ['Organization', 'WebSite', 'SoftwareApplication'])
            assert.ok(
                graph.some((n) => n['@type'] === t),
                t,
            )
    })

    it('imagens decorativas e o canvas ficam fora da árvore de acessibilidade', () => {
        assert.match(html, /<canvas id="gl" aria-hidden="true">/)
    })

    it('gera sitemap e robots com a URL do site', async () => {
        const sitemap = await readFile(join(dir, 'sitemap.xml'), 'utf8')
        assert.match(sitemap, new RegExp(`<loc>${SITE}/</loc>`))
        assert.match(sitemap, new RegExp(`<loc>${SITE}/aprender/o-que-e-etf/</loc><lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`))
        assert.match(await readFile(join(dir, 'robots.txt'), 'utf8'), new RegExp(`Sitemap: ${SITE}/sitemap.xml`))
    })

    it('assets têm hash no nome e o JS da cena é um chunk separado do principal', async () => {
        assert.match(html, /\/assets\/main-[A-Z0-9]+\.js/)
        assert.doesNotMatch(html, /scene-/)
        assert.match(await readFile(join(dir, '_headers'), 'utf8'), /\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/)
    })
})

async function htmlFiles(dir) {
    const out = []
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) out.push(...(await htmlFiles(p)))
        else if (e.name.endsWith('.html')) out.push(p)
    }
    return out
}

const LD = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/

describe('guias (páginas de conteúdo)', () => {
    let dir
    let files
    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'landing-guias-'))
        await buildLanding({ siteUrl: SITE, appUrl: APP, outDir: dir, archive: [] })
        files = await htmlFiles(dir)
    })
    after(() => rm(dir, { recursive: true, force: true }))

    it('gera o hub e os três guias (Tesouro Direto, ETF e Selic)', () => {
        const rel = files.map((f) => f.slice(dir.length))
        for (const slug of ['o-que-e-tesouro-direto', 'o-que-e-etf', 'o-que-e-selic-e-cdi'])
            assert.ok(rel.includes(`/aprender/${slug}/index.html`), slug)
        assert.ok(rel.includes('/aprender/index.html'))
    })

    it('cada página tem h1 único, canonical, JSON-LD válido e nada de preço, travessão ou placeholder', async () => {
        for (const f of files) {
            const html = await readFile(f, 'utf8')
            const where = f.slice(dir.length)
            assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, where)
            assert.match(html, /<link rel="canonical" href="https:\/\/exemplo\.test\//, where)
            assert.equal(html.match(/\{\{[A-Za-z_:-]+\}\}/g), null, where)
            const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')
            assert.doesNotMatch(text, /gr[áa]tis|sem cart[ãa]o|\bPRO\b|assinatura/i, where)
            assert.doesNotMatch(text, /—/, where + ' (travessão)')
            assert.ok(JSON.parse(html.match(LD)[1]), where)
        }
    })

    it('todo link interno aponta para uma página que existe', async () => {
        const existing = new Set(files.map((f) => f.slice(dir.length).replace(/index\.html$/, '')))
        for (const f of files) {
            const html = await readFile(f, 'utf8')
            for (const m of html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
                const path = m[1]
                if (path.startsWith('/assets/') || /\.(ico|png|xml|txt)$/.test(path)) continue
                assert.ok(existing.has(path), `${f.slice(dir.length)} aponta para ${path}, que não existe`)
            }
        }
    })

    it('a home e os guias se ligam (menu da home e links do cabeçalho dos guias)', async () => {
        const home = await readFile(join(dir, 'index.html'), 'utf8')
        assert.match(home, /<a href="\/aprender\/">Guias<\/a>/)
        const guide = await readFile(join(dir, 'aprender/o-que-e-etf/index.html'), 'utf8')
        assert.match(guide, /href="\/#como-funciona"/)
        assert.doesNotMatch(guide, /href="#como-funciona"/)
    })

    it('Tesouro Direto: números vêm dos fatos e a seção Fontes cita a página oficial', async () => {
        const html = await readFile(join(dir, 'aprender/o-que-e-tesouro-direto/index.html'), 'utf8')
        assert.match(html, /tesourodireto\.com\.br\/en\/sobre-o-tesouro\/regras-e-regulamento/)
        assert.match(html, /a partir de R\$ 2/)
        assert.match(html, /0,20% ao ano/)
        assert.match(html, /conferido em \d{2}\/\d{2}\/\d{4}/)
    })

    it('ETF: liquidação, imposto e a ressalva da isenção de R$ 20 mil vêm dos fatos', async () => {
        const html = await readFile(join(dir, 'aprender/o-que-e-etf/index.html'), 'utf8')
        assert.match(html, /D\+2/)
        assert.match(html, /15% em operações normais e de 20% em day trade/)
        assert.match(html, /não para ETF/)
        const graph = JSON.parse(html.match(LD)[1])['@graph']
        assert.deepEqual(
            graph.map((n) => n['@type']),
            ['Article', 'BreadcrumbList', 'FAQPage'],
        )
        const faq = graph.find((n) => n['@type'] === 'FAQPage').mainEntity
        assert.ok(faq.every((q) => !/\{\{/.test(q.acceptedAnswer.text)))
        assert.match(JSON.stringify(faq), /15% em operações normais/)
    })
})

describe('fatos regulatórios nos guias', () => {
    const fact = { id: 'x', label: 'x', value: 'valor', source: 'https://x', check: 'pagina-oficial', verifiedAt: '2026-10-04' }

    it('rejeita fato conferido só por trecho de busca', () => {
        assert.throws(() => checkFact({ ...fact, check: 'trecho-de-busca' }, new Date('2026-10-11'), 365), /trecho de busca/)
    })
    it('rejeita fato com mais de 12 meses', () => {
        assert.throws(() => checkFact(fact, new Date('2027-10-11'), 365), /verificado há/)
        assert.doesNotThrow(() => checkFact(fact, new Date('2027-10-01'), 365))
    })
    it('falha com fato desconhecido e substitui o conhecido', () => {
        assert.throws(() => resolveFacts('{{fact:nao-existe}}', new Map()), /desconhecido/)
        assert.equal(resolveFacts('a {{fact:x}} b', new Map([['x', fact]])), 'a valor b')
    })
    it('resolvePage troca fatos em corpo, tabela e FAQ e preserva slug e datas', () => {
        const page = {
            slug: 's-{{fact:x}}',
            updated: '2026-10-11',
            facts: ['x'],
            sections: [{ h: 'h', blocks: [{ p: 'p {{fact:x}}' }, { table: { head: ['a'], rows: [['{{fact:x}}']] } }] }],
            faq: [{ q: 'q', a: '{{fact:x}}' }],
        }
        const r = resolvePage(page, new Map([['x', fact]]))
        assert.equal(r.sections[0].blocks[0].p, 'p valor')
        assert.equal(r.sections[0].blocks[1].table.rows[0][0], 'valor')
        assert.equal(r.faq[0].a, 'valor')
        assert.equal(r.slug, page.slug)
        assert.deepEqual([...usedFactIds(page)], ['x'])
    })
    it('inline escapa HTML e só aceita links internos', () => {
        assert.equal(inline('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;')
        assert.equal(inline('[a](/aprender/b/)'), '<a href="/aprender/b/">a</a>')
        assert.equal(inline('[a](https://evil.test)'), '[a](https://evil.test)')
    })
})

describe('analytics (Cloudflare Web Analytics)', () => {
    const TOKEN = 'a'.repeat(32)

    it('sem token, nenhuma página carrega o beacon nem deixa placeholder', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'landing-an0-'))
        await buildLanding({ siteUrl: SITE, appUrl: APP, outDir: dir, analyticsToken: '', archive: [] })
        for (const f of await htmlFiles(dir)) {
            const html = await readFile(f, 'utf8')
            assert.doesNotMatch(html, /cloudflareinsights|\{\{ANALYTICS\}\}/, f)
        }
        await rm(dir, { recursive: true, force: true })
    })

    it('com token, a home e todos os guias carregam o beacon com o token', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'landing-an1-'))
        await buildLanding({ siteUrl: SITE, appUrl: APP, outDir: dir, analyticsToken: TOKEN, archive: [] })
        const files = await htmlFiles(dir)
        assert.ok(files.length >= 5)
        for (const f of files) {
            const html = await readFile(f, 'utf8')
            assert.match(
                html,
                new RegExp(`static\\.cloudflareinsights\\.com/beacon\\.min\\.js" data-cf-beacon='\\{"token": "${TOKEN}"\\}'`),
                f,
            )
        }
        await rm(dir, { recursive: true, force: true })
    })

    it('recusa token fora do formato e a CSP libera só o domínio do beacon', async () => {
        assert.throws(() => analyticsSnippet('curto'), /inválido/)
        assert.equal(analyticsSnippet(''), '')
        const headers = await readFile('src/static/_headers', 'utf8')
        assert.match(headers, /script-src 'self' https:\/\/static\.cloudflareinsights\.com;/)
        assert.match(headers, /connect-src 'self' https:\/\/cloudflareinsights\.com {{API_URL}};/)
    })
})

describe('gráficos determinísticos', () => {
    it('sparkline tem altos e baixos (nunca monotônica)', () => {
        const { pts } = sparklinePoints()
        const ups = pts.slice(1).filter((p, i) => p[1] < pts[i][1]).length
        const downs = pts.slice(1).filter((p, i) => p[1] > pts[i][1]).length
        assert.ok(ups > 3 && downs > 3)
        assert.deepEqual(sparklinePoints(), sparklinePoints())
    })

    it('trilha: cada marco acima do anterior, com ruído entre eles', () => {
        for (let i = 1; i < TRAIL_MARKS.length; i++) assert.ok(TRAIL_MARKS[i][1] < TRAIL_MARKS[i - 1][1])
        const full = trailPoints()
        assert.equal(full.length, (TRAIL_MARKS.length - 1) * 4 + 1)
        const [a, b] = [full[1], full[2]]
        assert.notEqual(a[1], b[1])
    })
})

describe('página do Diário Selucra (/diario/)', () => {
    const API = 'https://api.exemplo.test'
    let dir
    let html
    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'landing-diario-'))
        await buildLanding({ siteUrl: SITE, appUrl: APP, apiUrl: API, outDir: dir, archive: [] })
        html = await readFile(join(dir, 'diario/index.html'), 'utf8')
    })
    after(() => rm(dir, { recursive: true, force: true }))

    it('o conteúdo para busca está no HTML entregue (título, como jogar, o que se aprende, perguntas)', () => {
        assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1)
        assert.match(html, /<h1>Diário Selucra<\/h1>/)
        for (const id of ['como-jogar', 'o-que-se-aprende', 'duvidas']) assert.match(html, new RegExp(`id="${id}"`))
        assert.ok((html.match(/<summary>/g) ?? []).length >= 4)
        assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/diario/"`))
    })

    it('sem JS a página explica que o jogo precisa de JavaScript', () => {
        assert.match(html, /<noscript>[\s\S]*precisa de JavaScript[\s\S]*<\/noscript>/)
    })

    it('monta o jogo com um bundle próprio, sem a cena da home, e passa a API e o site por atributo', () => {
        assert.match(html, /<script type="module" src="\/assets\/diario-page-[^"]+\.js"><\/script>/)
        assert.doesNotMatch(html, /\/assets\/main-/)
        assert.match(html, new RegExp(`id="diario" data-api="${API}" data-app="${APP}" data-site="${SITE}" data-guides="[^"]*o-que-e-etf`))
    })

    it('o convite ao terminar começa escondido e leva ao app com origem=diario e ao cadastro', () => {
        const invite = html.match(/<aside[^>]*id="diario-convite"[\s\S]*?<\/aside>/)[0]
        assert.match(invite, /\bhidden\b/)
        assert.match(invite, /Entre no app para ganhar XP e manter sua sequência/)
        assert.match(invite, new RegExp(`href="${APP}/diario\\?origem=diario"`))
        assert.match(invite, new RegExp(`href="${APP}/login\\?modo=cadastro&origem=diario"`))
    })

    it('está no menu da home e do cabeçalho dos guias, e no sitemap', async () => {
        const home = await readFile(join(dir, 'index.html'), 'utf8')
        assert.match(home, /<li><a href="\/diario\/">Diário<\/a><\/li>/)
        assert.match(html, /<li><a href="\/diario\/">Diário<\/a><\/li>/)
        assert.match(await readFile(join(dir, 'sitemap.xml'), 'utf8'), new RegExp(`<loc>${SITE}/diario/</loc>`))
    })

    it('SEO: title, description, canonical, Open Graph com imagem própria e Twitter card', async () => {
        const title = html.match(/<title>(.*?)<\/title>/)[1]
        const desc = html.match(/name="description"\s+content="([^"]*)"/)[1]
        assert.ok(title.length <= 65, `title com ${title.length} caracteres`)
        assert.ok(desc.length >= 100 && desc.length <= 160, `description com ${desc.length} caracteres`)
        assert.match(html, new RegExp(`og:url" content="${SITE}/diario/"`))
        assert.match(html, new RegExp(`og:image" content="${SITE}/og-diario.png"`))
        assert.match(html, new RegExp(`twitter:image" content="${SITE}/og-diario.png"`))
        assert.ok((await stat(join(dir, 'og-diario.png'))).size > 1000)
        const home = await readFile(join(dir, 'index.html'), 'utf8')
        assert.match(home, new RegExp(`og:image" content="${SITE}/og-image.png"`))
    })

    it('JSON-LD: WebApplication e FAQPage espelhando as perguntas visíveis', () => {
        const graph = JSON.parse(html.match(LD)[1])['@graph']
        assert.deepEqual(
            graph.map((n) => n['@type']),
            ['WebApplication', 'FAQPage'],
        )
        const visible = (html.match(/<summary>/g) ?? []).length
        const faq = graph.find((n) => n['@type'] === 'FAQPage')
        assert.equal(faq.mainEntity.length, visible)
        assert.deepEqual(faq.mainEntity, faqFromHtml(html))
        assert.equal(graph[0].url, `${SITE}/diario/`)
    })

    it('CSP libera só a origem da API do Diário e a página não é cacheada por muito tempo', async () => {
        const headers = await readFile(join(dir, '_headers'), 'utf8')
        assert.ok(headers.includes(`connect-src 'self' https://cloudflareinsights.com ${API};`), headers)
        assert.doesNotMatch(headers, /\{\{/)
        assert.match(headers, /\/diario\/\*\s+Cache-Control: public, max-age=0, must-revalidate/)
    })

    it('sem preço, PRO, "grátis", travessão nem placeholder', () => {
        const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')
        assert.doesNotMatch(text, /gr[áa]tis|sem cart[ãa]o|\bPRO\b|assinatura|R\$ ?\d/i)
        assert.doesNotMatch(text, /—/)
        assert.equal(html.match(/\{\{[A-Za-z_:-]+\}\}/g), null)
    })
})
