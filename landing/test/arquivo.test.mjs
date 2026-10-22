import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { buildLanding } from '../build.mjs'
import { ARCHIVE_DATA_PATH, cleanArchive, gameJsonLd, gameMeta, isArchivedGame, loadArchive } from '../diarioArquivo.mjs'

const SITE = 'https://exemplo.test'
const APP = 'https://app.exemplo.test'
const API = 'https://api.exemplo.test'
const NOW = new Date('2026-11-04T10:00:00Z')

const game = (number, date, over = {}) => ({
    number,
    date,
    word: { answer: 'AÇÕES', length: 5, definition: 'Pedaços de uma empresa.', learnMore: { kind: 'guide', ref: 'o-que-e-etf' } },
    trivia: {
        question: 'Qual índice mede a inflação oficial?',
        options: ['IGP-M', 'IPCA', 'INPC', 'IPC-Fipe'],
        correctIndex: 1,
        explanation: 'O IPCA é a referência da meta de inflação.',
        sourceRef: 'IBGE',
        learnMore: null,
    },
    ...over,
})

const GAMES = [game(3, '2026-11-03'), game(2, '2026-11-02'), game(1, '2026-11-01')]

describe('arquivo do Diário: dados', () => {
    it('só mantém jogos válidos de dias anteriores, sem repetir número, do mais recente ao mais antigo', () => {
        const dirty = [
            game(1, '2026-11-01'),
            game(2, '2026-11-02'),
            game(2, '2026-11-02'),
            game(4, '2026-11-04'), // o dia de hoje (UTC) ainda não encerrou
            game(5, '2026-11-05'), // futuro
            { number: 9, date: '2026-10-01' }, // malformado
            game(6, '2026-10-30', { trivia: { ...game(6, 'x').trivia, correctIndex: 7 } }),
            null,
        ]
        assert.deepEqual(
            cleanArchive(dirty, NOW).map((g) => g.number),
            [2, 1],
        )
        assert.deepEqual(cleanArchive('x', NOW), [])
    })

    it('o dia muda às 00:00 UTC (21h de Brasília): às 23:59 UTC o jogo daquela data ainda não entra', () => {
        const g = game(3, '2026-11-03')
        assert.equal(cleanArchive([g], new Date('2026-11-03T23:59:59Z')).length, 0)
        assert.equal(cleanArchive([g], new Date('2026-11-04T00:00:00Z')).length, 1)
    })

    it('rejeita jogo sem fonte ou sem explicação; a Linha do tempo de um jogo antigo é ignorada (DI18)', () => {
        assert.equal(isArchivedGame(game(1, '2026-11-01', { trivia: { ...game(1, 'x').trivia, explanation: 7 } })), false)
        assert.equal(isArchivedGame(game(1, '2026-11-01', { timeline: { events: [] } })), true)
        assert.equal(isArchivedGame(game(1, '2026-11-01', { trivia: { ...game(1, 'x').trivia, sourceRef: '' } })), false)
        assert.equal(isArchivedGame(game(1, '2026-11-01')), true)
    })
})

describe('arquivo do Diário: carga no build', () => {
    const json = (body) => async () => ({ ok: true, json: async () => body })
    const warnings = []
    const warn = (m) => warnings.push(m)

    it('usa a API quando ela responde', async () => {
        const urls = []
        const fetchImpl = async (url) => (urls.push(url), { ok: true, json: async () => ({ games: GAMES }) })
        const r = await loadArchive({ apiUrl: API, siteUrl: SITE, now: NOW, fetchImpl, warn })
        assert.equal(r.source, 'api')
        assert.equal(r.games.length, 3)
        assert.deepEqual(urls, [`${API}/daily/archive`])
    })

    it('com a API fora, mantém o arquivo do deploy anterior e não falha', async () => {
        const fetchImpl = async (url) => {
            if (url.startsWith(API)) throw new Error('fora do ar')
            assert.equal(url, `${SITE}/${ARCHIVE_DATA_PATH}`)
            return { ok: true, json: async () => ({ games: GAMES.slice(1) }) }
        }
        const r = await loadArchive({ apiUrl: API, siteUrl: SITE, now: NOW, fetchImpl, warn })
        assert.equal(r.source, 'previous')
        assert.deepEqual(
            r.games.map((g) => g.number),
            [2, 1],
        )
    })

    it('com a API fora e sem deploy anterior, segue sem arquivo (não lança)', async () => {
        const fetchImpl = async () => ({ ok: false, status: 503 })
        const r = await loadArchive({ apiUrl: API, siteUrl: SITE, now: NOW, fetchImpl, warn })
        assert.deepEqual(r, { games: [], source: 'none' })
        assert.ok(warnings.length >= 2)
    })

    it('resposta da API com formato estranho vira lista vazia', async () => {
        const r = await loadArchive({ apiUrl: API, siteUrl: SITE, now: NOW, fetchImpl: json({ games: 'x' }), warn })
        assert.deepEqual(r.games, [])
    })
})

describe('arquivo do Diário: páginas geradas', () => {
    let dir
    let read
    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'landing-arquivo-'))
        const evil = game(4, '2026-11-04', { word: { ...game(4, 'x').word, definition: '<script>alert(1)</script>' } })
        await buildLanding({
            siteUrl: SITE,
            appUrl: APP,
            apiUrl: API,
            outDir: dir,
            now: NOW,
            archive: cleanArchive([evil, ...GAMES], new Date('2026-11-05T01:00:00Z')),
        })
        read = (p) => readFile(join(dir, p), 'utf8')
    })
    after(() => rm(dir, { recursive: true, force: true }))

    it('gera uma página por jogo e o índice, com canonical, h1 único e as respostas', async () => {
        const html = await read('diario/arquivo/2/index.html')
        assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1)
        assert.match(html, /<h1>Diário Selucra nº 2, de 2 de novembro de 2026<\/h1>/)
        assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/diario/arquivo/2/"`))
        assert.match(html, /<strong>AÇÕES<\/strong>/)
        assert.match(html, /<li class="arq-certa"><strong>IPCA<\/strong> \(resposta certa\)<\/li>/)
        assert.doesNotMatch(html, /Linha do tempo/i)
        assert.match(html, /Fonte: IBGE/)
        assert.match(html, /href="\/aprender\/o-que-e-etf\/"/)
        const idx = await read('diario/arquivo/index.html')
        for (const n of [1, 2, 3, 4]) assert.match(idx, new RegExp(`href="/diario/arquivo/${n}/"`))
    })

    it('texto vindo da API é escapado (nada vira HTML)', async () => {
        const html = await read('diario/arquivo/4/index.html')
        assert.doesNotMatch(html, /<script>alert/)
        assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
        // No JSON-LD o `<` também é escapado, e o bloco continua sendo JSON válido.
        const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
        assert.doesNotMatch(ld, /</)
        assert.match(JSON.parse(ld)['@graph'][2].mainEntity[1].acceptedAnswer.text, /<script>alert\(1\)<\/script>/)
    })

    it('liga os dias vizinhos e volta ao jogo de hoje', async () => {
        const html = await read('diario/arquivo/2/index.html')
        assert.match(html, /href="\/diario\/arquivo\/1\/"[^>]*>Nº 1: dia anterior/)
        assert.match(html, /href="\/diario\/arquivo\/3\/"[^>]*>Nº 3: dia seguinte/)
        assert.match(html, /href="\/diario\/"[^>]*>Jogar agora/)
    })

    it('entra no sitemap com lastmod e a página do Diário aponta para o arquivo', async () => {
        const sitemap = await read('sitemap.xml')
        assert.match(sitemap, new RegExp(`<loc>${SITE}/diario/arquivo/</loc>`))
        assert.match(sitemap, new RegExp(`<loc>${SITE}/diario/arquivo/2/</loc><lastmod>2026-11-02</lastmod>`))
        const diario = await read('diario/index.html')
        assert.match(diario, /id="arquivo"/)
        assert.match(diario, /href="\/diario\/arquivo\/"/)
    })

    it('guarda os jogos em jogos.json para servir de base ao próximo build', async () => {
        const saved = JSON.parse(await read(ARCHIVE_DATA_PATH))
        assert.deepEqual(
            saved.games.map((g) => g.number),
            [4, 3, 2, 1],
        )
    })

    it('o JSON-LD traz Article, BreadcrumbList e as duas perguntas', () => {
        const ld = JSON.parse(gameJsonLd(GAMES[0], { siteUrl: SITE }))
        assert.deepEqual(
            ld['@graph'].map((x) => x['@type']),
            ['Article', 'BreadcrumbList', 'FAQPage'],
        )
        assert.match(ld['@graph'][2].mainEntity[0].acceptedAnswer.text, /^IPCA\./)
        assert.ok(gameMeta(GAMES[0], SITE).title.length <= 70)
        assert.ok(gameMeta(GAMES[0], SITE).description.length <= 200)
    })
})

describe('arquivo do Diário: sem jogo encerrado', () => {
    let dir
    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'landing-arquivo-vazio-'))
        await buildLanding({ siteUrl: SITE, appUrl: APP, apiUrl: API, outDir: dir, now: NOW, archive: [] })
    })
    after(() => rm(dir, { recursive: true, force: true }))

    it('não cria o arquivo, nem entrada no sitemap, nem o bloco na página do Diário', async () => {
        await assert.rejects(access(join(dir, 'diario/arquivo')))
        assert.doesNotMatch(await readFile(join(dir, 'sitemap.xml'), 'utf8'), /diario\/arquivo/)
        assert.doesNotMatch(await readFile(join(dir, 'diario/index.html'), 'utf8'), /id="arquivo"/)
    })
})
