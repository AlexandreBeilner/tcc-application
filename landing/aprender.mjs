// Guias de conteúdo gerados no build a partir de content/aprender/*.json.
// Os números regulatórios nunca são digitados no JSON: entram por {{fact:id}}, lidos de
// backend/src/modules/lessons/domain/regulatoryFacts.ts (a mesma fonte das lições), e a
// build falha se o fato não existir, não foi aberto em página oficial ou passou de 12 meses.
import { build } from 'esbuild'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const FACTS_PATH = fileURLToPath(new URL('../backend/src/modules/lessons/domain/regulatoryFacts.ts', import.meta.url))
const MS_DAY = 86_400_000

export async function loadFacts() {
    const out = await build({ entryPoints: [FACTS_PATH], bundle: true, format: 'esm', write: false, logLevel: 'silent' })
    const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
    return { facts: new Map(mod.REGULATORY_FACTS.map((f) => [f.id, f])), maxAgeDays: mod.MAX_FACT_AGE_DAYS }
}

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Inline: **negrito** e [texto](/caminho/). Tudo mais é escapado.
export function inline(text) {
    return esc(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
}

export function resolveFacts(text, facts) {
    return text.replace(/\{\{fact:([a-z0-9-]+)\}\}/g, (_, id) => {
        const f = facts.get(id)
        if (!f) throw new Error(`fato desconhecido: ${id}`)
        return f.value
    })
}

export function checkFact(f, now, maxAgeDays) {
    if (f.check !== 'pagina-oficial')
        throw new Error(`fato "${f.id}" foi conferido só por trecho de busca; reabra na fonte antes de publicar`)
    const age = (now - new Date(f.verifiedAt)) / MS_DAY
    if (age > maxAgeDays) throw new Error(`fato "${f.id}" verificado há ${Math.round(age)} dias (máximo ${maxAgeDays})`)
}

const fmtDate = (iso) => iso.split('-').reverse().join('/')

// Todo {{fact:id}} usado no texto precisa estar em `facts` do guia, para a seção Fontes ser completa.
export function usedFactIds(page) {
    const ids = new Set()
    const scan = (t) => {
        for (const m of String(t).matchAll(/\{\{fact:([a-z0-9-]+)\}\}/g)) ids.add(m[1])
    }
    for (const s of page.sections)
        for (const b of s.blocks) {
            if (b.p) scan(b.p)
            if (b.ul) b.ul.forEach(scan)
            if (b.table) b.table.rows.flat().forEach(scan)
        }
    return ids
}

// Resolve {{fact:id}} em todos os textos do guia (corpo, tabelas e FAQ), menos nos campos técnicos.
export function resolvePage(page, facts) {
    const walk = (v, key) => {
        if (typeof v === 'string') return key === 'slug' || key === 'published' || key === 'updated' ? v : resolveFacts(v, facts)
        if (Array.isArray(v)) return v.map((x) => walk(x, key))
        if (v && typeof v === 'object')
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'facts' || k === 'related' ? x : walk(x, k)]))
        return v
    }
    return walk(page)
}

function block(b, facts) {
    if (b.p) return `<p>${inline(resolveFacts(b.p, facts))}</p>`
    if (b.ul) return `<ul>${b.ul.map((i) => `<li>${inline(resolveFacts(i, facts))}</li>`).join('')}</ul>`
    if (b.table) {
        const head = b.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')
        const rows = b.table.rows
            .map(
                (r) =>
                    `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${inline(resolveFacts(c, facts))}</th>` : `<td>${inline(resolveFacts(c, facts))}</td>`)).join('')}</tr>`,
            )
            .join('')
        return `<div class="tbl"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
    }
    throw new Error('bloco desconhecido: ' + JSON.stringify(b).slice(0, 60))
}

export function renderArticle(page, { facts, all, appUrl }) {
    page = resolvePage(page, facts)
    const sections = page.sections
        .map((s) => `<section class="art-sec"><h2>${esc(s.h)}</h2>${s.blocks.map((b) => block(b, facts)).join('')}</section>`)
        .join('\n')
    const sources = page.facts
        .map((id) => facts.get(id))
        .map(
            (f) =>
                `<li><a href="${esc(f.source)}" rel="noopener" target="_blank">${esc(f.label)}</a>, conferido em ${fmtDate(f.verifiedAt)}.</li>`,
        )
        .join('')
    const faq = page.faq.map((x) => `<details><summary>${esc(x.q)}</summary><p>${inline(x.a)}</p></details>`).join('\n')
    const related = page.related
        .map((slug) => all.find((p) => p.slug === slug))
        .map((p) => `<li><a href="/aprender/${p.slug}/">${esc(p.title)}</a><small>${esc(p.summary)}</small></li>`)
        .join('')
    return `<article class="art wrap">
    <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a><span aria-hidden="true">/</span><a href="/aprender/">Guias</a><span aria-hidden="true">/</span><span aria-current="page">${esc(page.h1)}</span></nav>
    <header class="art-head"><span class="eyebrow">Guia</span><h1>${esc(page.h1)}</h1><p class="lead">${esc(page.lead)}</p>
    <p class="meta">Atualizado em <time datetime="${page.updated}">${fmtDate(page.updated)}</time></p></header>
    ${sections}
    <aside class="art-cta"><h2>${esc(page.ctaTitle || 'Pratique sem arriscar dinheiro de verdade')}</h2><p>${esc(page.cta)}</p><a class="btn btn-primary" href="${appUrl}/login?modo=cadastro">Criar conta</a></aside>
    <section class="art-sec" id="faq"><h2>Dúvidas frequentes</h2>${faq}</section>
    <section class="art-sec"><h2>Continue aprendendo</h2><ul class="related">${related}</ul></section>
    <section class="art-sec sources"><details><summary>Fontes das regras citadas neste guia</summary><ul>${sources}</ul></details></section>
</article>`
}

export function articleJsonLd(page, { siteUrl, facts }) {
    if (facts) page = resolvePage(page, facts)
    const url = `${siteUrl}/aprender/${page.slug}/`
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Article',
                '@id': `${url}#article`,
                headline: page.h1,
                description: page.description,
                inLanguage: 'pt-BR',
                datePublished: page.published,
                dateModified: page.updated,
                image: `${siteUrl}/og-image.png`,
                mainEntityOfPage: url,
                author: { '@type': 'Organization', name: 'Selucra', url: `${siteUrl}/` },
                publisher: {
                    '@type': 'Organization',
                    name: 'Selucra',
                    url: `${siteUrl}/`,
                    logo: { '@type': 'ImageObject', url: `${siteUrl}/icon-512.png` },
                },
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Início', item: `${siteUrl}/` },
                    { '@type': 'ListItem', position: 2, name: 'Guias', item: `${siteUrl}/aprender/` },
                    { '@type': 'ListItem', position: 3, name: page.h1, item: url },
                ],
            },
            {
                '@type': 'FAQPage',
                mainEntity: page.faq.map((x) => ({
                    '@type': 'Question',
                    name: x.q,
                    acceptedAnswer: { '@type': 'Answer', text: x.a.replace(/\*\*|\[([^\]]+)\]\([^)]*\)/g, '$1') },
                })),
            },
        ],
    })
}

export function hubHtml(all) {
    const cards = all
        .map(
            (p) =>
                `<li><a href="/aprender/${p.slug}/"><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><span>Ler o guia</span></a></li>`,
        )
        .join('')
    return `<section class="art wrap">
    <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a><span aria-hidden="true">/</span><span aria-current="page">Guias</span></nav>
    <header class="art-head"><span class="eyebrow">Guias</span><h1>Guias para aprender a investir</h1><p class="lead">Explicações diretas sobre Selic, ETF e Tesouro Direto, com as regras conferidas em fonte oficial.</p></header>
    <ul class="guides">${cards}</ul>
</section>`
}

export async function loadPages(dir = new URL('./content/aprender/', import.meta.url)) {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(new URL(f, dir), 'utf8'))))
}
