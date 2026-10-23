// Arquivo público do Diário Selucra (DI.3.4): uma página estática por jogo já encerrado
// (`/diario/arquivo/<n>/`) e um índice (`/diario/arquivo/`). Os dados vêm de `GET /daily/archive`
// no momento do build; o build agendado diário (`.github/workflows/diario-arquivo.yml`) gera as
// páginas novas. O jogo do dia nunca entra: o API só devolve jogo encerrado e o build filtra de novo.
import { esc } from './aprender.mjs'

const MS_DAY = 86_400_000
export const ARCHIVE_DATA_PATH = 'diario/arquivo/jogos.json'

export const fmtDate = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// JSON dentro de <script>: `<` vira \u003c para que texto vindo da API nunca feche a tag.
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

const isString = (v) => typeof v === 'string' && v.length > 0
const isLearnMore = (v) => v === null || (v && typeof v === 'object' && isString(v.kind) && isString(v.ref))

// Só entra no site o que tem a forma esperada: um jogo malformado é descartado, nunca derruba o build.
export function isArchivedGame(g) {
    return Boolean(
        g &&
        Number.isInteger(g.number) &&
        g.number >= 1 &&
        /^\d{4}-\d{2}-\d{2}$/.test(g.date ?? '') &&
        isString(g.word?.answer) &&
        isString(g.word?.definition) &&
        isLearnMore(g.word?.learnMore ?? null) &&
        isString(g.trivia?.question) &&
        Array.isArray(g.trivia?.options) &&
        g.trivia.options.length >= 2 &&
        g.trivia.options.every(isString) &&
        Number.isInteger(g.trivia?.correctIndex) &&
        g.trivia.correctIndex >= 0 &&
        g.trivia.correctIndex < g.trivia.options.length &&
        isString(g.trivia?.explanation) &&
        isString(g.trivia?.sourceRef) &&
        isLearnMore(g.trivia?.learnMore ?? null),
    )
}

// Normaliza: só jogos válidos, só os de dias anteriores a `now` (UTC, a regra do dia do Diário),
// sem número repetido, do mais recente ao mais antigo.
export function cleanArchive(games, now = new Date()) {
    if (!Array.isArray(games)) return []
    const today = now.toISOString().slice(0, 10)
    const seen = new Set()
    return games
        .filter((g) => isArchivedGame(g) && g.date < today && !seen.has(g.number) && seen.add(g.number))
        .sort((a, b) => b.number - a.number)
}

async function getJson(url, fetchImpl, timeoutMs) {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    return res.json()
}

// Carrega o arquivo para o build. Se a API estiver fora, usa o `jogos.json` do deploy anterior
// (publicado junto das páginas); se nem isso existir, constrói sem arquivo e avisa, sem falhar:
// o build da landing não pode depender da API estar de pé.
export async function loadArchive({ apiUrl, siteUrl, now = new Date(), fetchImpl = fetch, timeoutMs = 15_000, warn = console.warn }) {
    try {
        const body = await getJson(`${apiUrl}/daily/archive`, fetchImpl, timeoutMs)
        return { games: cleanArchive(body?.games, now), source: 'api' }
    } catch (err) {
        warn(`diário: API do arquivo indisponível (${err.message}); tentando o arquivo do deploy anterior`)
    }
    try {
        const previous = await getJson(`${siteUrl}/${ARCHIVE_DATA_PATH}`, fetchImpl, timeoutMs)
        return { games: cleanArchive(previous?.games, now), source: 'previous' }
    } catch (err) {
        warn(`diário: sem arquivo anterior (${err.message}); o build segue sem páginas do arquivo`)
        return { games: [], source: 'none' }
    }
}

const learnLink = (l, guideSlugs) => (l?.kind === 'guide' && guideSlugs.has(l.ref) ? `/aprender/${l.ref}/` : null)

function wordText(g) {
    return `${g.word.answer.length} letras`
}

export function gamePath(n) {
    return `/diario/arquivo/${n}/`
}

export function gameMeta(g, siteUrl) {
    return {
        title: `Diário Selucra nº ${g.number}: ${g.word.answer} e as respostas do dia`,
        description: `Respostas e explicações do Diário Selucra nº ${g.number}, de ${fmtDate(g.date)}: a palavra ${g.word.answer} e a pergunta do dia.`,
        url: `${siteUrl}${gamePath(g.number)}`,
    }
}

export function renderGame(g, { guideSlugs, appUrl, prev, next }) {
    const more = (l) => {
        const href = learnLink(l, guideSlugs)
        return href ? ` <a href="${href}">Ler o guia</a>` : ''
    }
    const options = g.trivia.options
        .map((o, i) =>
            i === g.trivia.correctIndex ? `<li class="arq-certa"><strong>${esc(o)}</strong> (resposta certa)</li>` : `<li>${esc(o)}</li>`,
        )
        .join('')
    const nav = [
        prev ? `<a href="${gamePath(prev.number)}">Nº ${prev.number}: dia anterior</a>` : '',
        next ? `<a href="${gamePath(next.number)}">Nº ${next.number}: dia seguinte</a>` : '',
    ]
        .filter(Boolean)
        .join('')
    return `<article class="art wrap diario-arquivo">
    <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a><span aria-hidden="true">/</span><a href="/diario/">Diário Selucra</a><span aria-hidden="true">/</span><a href="/diario/arquivo/">Arquivo</a><span aria-hidden="true">/</span><span aria-current="page">Nº ${g.number}</span></nav>
    <header class="art-head"><span class="eyebrow">Jogo encerrado</span><h1>Diário Selucra nº ${g.number}, de ${fmtDate(g.date)}</h1>
    <p class="lead">As respostas e as explicações do jogo daquele dia: a palavra do mercado e a pergunta de economia.</p></header>
    <section class="art-sec"><h2>Palavra do dia</h2>
    <p>A palavra tinha ${wordText(g)}: <strong>${esc(g.word.answer)}</strong>.</p>
    <p>${esc(g.word.definition)}${more(g.word.learnMore)}</p></section>
    <section class="art-sec"><h2>Pergunta do dia</h2>
    <p><strong>${esc(g.trivia.question)}</strong></p>
    <ul class="arq-opcoes">${options}</ul>
    <p>${esc(g.trivia.explanation)}${more(g.trivia.learnMore)}</p>
    <p><small class="arq-fonte">Fonte: ${esc(g.trivia.sourceRef)}</small></p></section>
    <aside class="art-cta"><h2>Jogue o Diário de hoje</h2><p>Um jogo novo sai todo dia às 21h, no horário de Brasília. No app, cada Diário rende XP e conta para a sua sequência.</p>
    <p class="diario-invite-actions"><a class="btn btn-primary" href="/diario/">Jogar agora</a><a class="btn btn-ghost" href="${appUrl}/login?modo=cadastro&amp;origem=diario">Criar conta</a></p></aside>
    <nav class="arq-nav" aria-label="Outros dias">${nav}<a href="/diario/arquivo/">Todos os dias</a></nav>
</article>`
}

export function renderIndex(games) {
    const items = games
        .map(
            (g) =>
                `<li><a href="${gamePath(g.number)}"><h2>Nº ${g.number}: ${esc(fmtDate(g.date))}</h2><p>Palavra: ${esc(g.word.answer)}. ${esc(g.trivia.question)}</p><span>Ver respostas</span></a></li>`,
        )
        .join('')
    return `<section class="art wrap diario-arquivo">
    <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a><span aria-hidden="true">/</span><a href="/diario/">Diário Selucra</a><span aria-hidden="true">/</span><span aria-current="page">Arquivo</span></nav>
    <header class="art-head"><span class="eyebrow">Arquivo</span><h1>Arquivo do Diário Selucra</h1><p class="lead">Os jogos já encerrados, com a palavra e a resposta da pergunta explicadas. O jogo de hoje só aparece aqui depois de acabar.</p></header>
    <ul class="guides">${items}</ul>
</section>`
}

export const indexMeta = (siteUrl, count) => ({
    title: 'Arquivo do Diário Selucra: respostas dos dias anteriores',
    description: `Respostas e explicações dos ${count} jogos já encerrados do Diário Selucra: palavras do mercado, perguntas de economia e linhas do tempo.`,
    url: `${siteUrl}/diario/arquivo/`,
})

export function gameJsonLd(g, { siteUrl }) {
    const meta = gameMeta(g, siteUrl)
    const correct = g.trivia.options[g.trivia.correctIndex]
    const dated = `${g.date}T00:00:00Z`
    const next = new Date(Date.parse(dated) + MS_DAY).toISOString().slice(0, 10)
    return safeJson({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Article',
                '@id': `${meta.url}#article`,
                headline: meta.title,
                description: meta.description,
                inLanguage: 'pt-BR',
                datePublished: next,
                dateModified: next,
                image: `${siteUrl}/og-diario.png`,
                mainEntityOfPage: meta.url,
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
                    { '@type': 'ListItem', position: 2, name: 'Diário Selucra', item: `${siteUrl}/diario/` },
                    { '@type': 'ListItem', position: 3, name: 'Arquivo', item: `${siteUrl}/diario/arquivo/` },
                    { '@type': 'ListItem', position: 4, name: `Nº ${g.number}`, item: meta.url },
                ],
            },
            {
                '@type': 'FAQPage',
                mainEntity: [
                    {
                        '@type': 'Question',
                        name: g.trivia.question,
                        acceptedAnswer: { '@type': 'Answer', text: `${correct}. ${g.trivia.explanation}` },
                    },
                    {
                        '@type': 'Question',
                        name: `Qual era a palavra do Diário Selucra nº ${g.number}?`,
                        acceptedAnswer: { '@type': 'Answer', text: `${g.word.answer}. ${g.word.definition}` },
                    },
                ],
            },
        ],
    })
}

export function indexJsonLd(games, { siteUrl }) {
    const meta = indexMeta(siteUrl, games.length)
    return safeJson({
        '@context': 'https://schema.org',
        '@graph': [
            { '@type': 'CollectionPage', name: meta.title, url: meta.url, inLanguage: 'pt-BR' },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Início', item: `${siteUrl}/` },
                    { '@type': 'ListItem', position: 2, name: 'Diário Selucra', item: `${siteUrl}/diario/` },
                    { '@type': 'ListItem', position: 3, name: 'Arquivo', item: meta.url },
                ],
            },
        ],
    })
}

// Bloco da página /diario/ que leva ao arquivo; some enquanto não há jogo encerrado.
export function archiveTeaser(games) {
    if (games.length === 0) return ''
    const last = games[0]
    return `<section class="art-sec" id="arquivo"><h2>Dias anteriores</h2><p>Perdeu um dia? O <a href="/diario/arquivo/">arquivo do Diário</a> traz a palavra e a resposta da pergunta de cada jogo encerrado, a partir do nº ${games[games.length - 1].number} até o nº ${last.number}.</p></section>`
}
