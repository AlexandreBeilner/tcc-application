import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDailyApi, DailyApiError, reportMetric } from '../../src/diario/api.ts'
import { createLocalKeeper, KEEP_GAMES, parseState, STORAGE_KEY } from '../../src/diario/keeper.ts'
import { applyGuess, applyTrivia, emptyProgress, parseProgress } from '../../src/diario/progress.ts'
import { buildShareText } from '../../src/diario/share.ts'
import { makeGame, memoryStorage } from './fixtures.ts'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

describe('cliente da API', () => {
    it('monta URL, corpo e cabeçalhos; token só quando existe; attempt só quando enviado', async () => {
        const seen: { url: string; init: RequestInit }[] = []
        const fakeFetch = (async (url: string, init: RequestInit) => {
            seen.push({ url, init })
            return json(200, { ok: true })
        }) as unknown as typeof fetch
        const anon = createDailyApi({ baseUrl: 'https://api.test/', fetch: fakeFetch })
        await anon.guess(47, 'CARRO', 2)
        await anon.trivia(47, 1)
        const logged = createDailyApi({ baseUrl: 'https://api.test', fetch: fakeFetch, getToken: () => 'tok' })
        await logged.guess(47, 'CARRO')
        assert.equal(seen[0].url, 'https://api.test/daily/47/word/guess')
        assert.deepEqual(JSON.parse(seen[0].init.body as string), { guess: 'CARRO', attempt: 2 })
        assert.equal((seen[0].init.headers as Record<string, string>).Authorization, undefined)
        assert.equal(seen[0].init.credentials, 'omit')
        assert.deepEqual(JSON.parse(seen[2].init.body as string), { guess: 'CARRO' })
        assert.equal((seen[2].init.headers as Record<string, string>).Authorization, 'Bearer tok')
    })

    it('transforma erros HTTP e falha de rede em DailyApiError', async () => {
        const api = createDailyApi({
            baseUrl: 'x',
            fetch: (async () => json(429, { error: 'rate' }, { 'Retry-After': '12' })) as unknown as typeof fetch,
        })
        await assert.rejects(api.today(), (e: DailyApiError) => e.status === 429 && e.retryAfter === 12)
        const down = createDailyApi({
            baseUrl: 'x',
            fetch: (async () => {
                throw new TypeError('x')
            }) as unknown as typeof fetch,
        })
        await assert.rejects(down.today(), (e: DailyApiError) => e.status === 0 && e.code === 'network')
        const bad = createDailyApi({
            baseUrl: 'x',
            fetch: (async () => new Response('<html>', { status: 502 })) as unknown as typeof fetch,
        })
        await assert.rejects(bad.today(), (e: DailyApiError) => e.status === 502 && e.code === null)
    })
})

function played(game = makeGame(), solvedIn = 2) {
    let p = emptyProgress(game)
    for (let i = 1; i <= solvedIn; i++)
        p = applyGuess(p, 'ACOES', {
            letters: ['correct', 'correct', 'correct', 'correct', 'correct'],
            solved: i === solvedIn,
            attempt: i,
            finished: i === solvedIn,
            ...(i === solvedIn ? { reveal: { answer: 'AÇÕES', definition: 'd', learnMore: null } } : {}),
        })
    p = applyTrivia(p, 1, { correct: true, correctIndex: 1, explanation: 'e', sourceRef: 's', learnMore: null })
    return p
}

describe('estado local', () => {
    it('parseProgress descarta formato inválido e número trocado', () => {
        const p = played()
        assert.ok(parseProgress(JSON.parse(JSON.stringify(p)), 47))
        assert.equal(parseProgress(JSON.parse(JSON.stringify(p)), 48), null)
        assert.equal(parseProgress({ ...p, word: { ...p.word, guesses: [{ guess: 'X', letters: ['roxo'] }] } }, 47), null)
        assert.equal(parseProgress('texto', 47), null)
    })

    it('guarda só os últimos 60 jogos e mantém as estatísticas', async () => {
        const storage = memoryStorage()
        const keeper = createLocalKeeper({ getStorage: () => storage, now: () => Date.parse('2026-12-17T10:00:00Z') })
        for (let n = 1; n <= 70; n++) await keeper.save(makeGame(n, { isToday: false }), played(makeGame(n)))
        const state = JSON.parse(storage.getItem(STORAGE_KEY)!)
        assert.equal(Object.keys(state.games).length, KEEP_GAMES)
        assert.ok(state.games['70'] && !state.games['10'])
        assert.equal(state.stats.word.played, 70)
    })

    it('sequência local: só jogo do dia concluído antes da virada conta; dia anterior não', async () => {
        const storage = memoryStorage()
        let clock = Date.parse('2026-12-17T10:00:00Z')
        const keeper = createLocalKeeper({ getStorage: () => storage, now: () => clock })
        const finish = (n: number, isToday: boolean) => {
            const g = makeGame(n, { isToday })
            if (isToday) clock = Date.parse(g.nextGameAt) - 3600_000
            return keeper.save(g, played(g))
        }
        await finish(45, true)
        await finish(46, true)
        assert.equal((await keeper.stats(46))!.currentStreak, 2)
        clock = Date.parse('2026-12-19T10:00:00Z')
        await finish(47, false) // dia anterior jogado depois: conta jogo, não a sequência
        const s = (await keeper.stats(48))!
        assert.equal(s.games, 3)
        assert.equal(s.currentStreak, 0) // 46 foi anteontem em relação ao 48
        assert.equal(s.longestStreak, 2)
        assert.deepEqual(await keeper.done!(), [45, 46, 47])
    })

    it('parseState: estatística adulterada (sequência no futuro) zera tudo sem lançar', () => {
        const bad = JSON.stringify({
            v: 1,
            games: {},
            stats: {
                games: 1,
                failed: 0,
                word: { played: 1, correct: 1 },
                trivia: { played: 0, correct: 0 },
                distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
                streak: { current: 5, longest: 5, last: 999 },
            },
        })
        assert.equal(parseState(bad, 47).stats.games, 0)
    })

    it('parseState: estado salvo com três cartões é lido ignorando a Linha do tempo (DI18)', () => {
        const old = { ...JSON.parse(JSON.stringify(played())), timeline: { answered: false } }
        const stats = { ...parseState(null, 47).stats, games: 4, timeline: { played: 4, correct: 1 } }
        const state = parseState(JSON.stringify({ v: 1, games: { '47': old }, stats }), 47)
        assert.equal(state.stats.games, 4)
        assert.equal('timeline' in state.stats, false)
        const game = state.games['47']
        assert.ok(game && 'timeline' in game === false)
        assert.equal(game.word.solved, true)
        assert.equal(game.trivia.answered, true)
    })

    it('parseState: jogo com número maior que o de hoje é ignorado, os outros ficam', () => {
        const ok = JSON.parse(JSON.stringify(played()))
        const text = JSON.stringify({ v: 1, games: { '47': ok, '99': { ...ok, number: 99 } }, stats: parseState(null, 47).stats })
        assert.deepEqual(Object.keys(parseState(text, 47).games), ['47'])
    })
})

describe('cartão compartilhável', () => {
    it('só tem número, cores e acertos, nunca a resposta nem R$', () => {
        const g = makeGame()
        const text = buildShareText(g, played(g, 3))
        assert.equal(text.split('\n')[0], 'Diário Selucra #47')
        assert.match(text, /palavra em 3/)
        assert.doesNotMatch(text, /AÇÕES|ACOES|R\$/)
    })
    it('palavra não resolvida', () => {
        const g = makeGame()
        const p = applyGuess(emptyProgress(g), 'CARRO', {
            letters: ['absent', 'present', 'absent', 'absent', 'absent'],
            solved: false,
            attempt: 6,
            finished: true,
        })
        assert.match(buildShareText(g, p, 'x.test/d'), /palavra não resolvida\n❓ ❌\nx\.test\/d$/)
    })
})

describe('aviso ao contador (DI.7.1)', () => {
    it('manda só o nome do evento, sem token e sem credenciais, e nunca lança', async () => {
        const seen: { url: string; init: RequestInit }[] = []
        const ok = (async (url: string, init: RequestInit) => {
            seen.push({ url, init })
            return json(204, null)
        }) as unknown as typeof fetch

        reportMetric('https://api.test/', 'started', ok)

        assert.equal(seen[0].url, 'https://api.test/daily/metrics')
        assert.deepEqual(JSON.parse(seen[0].init.body as string), { event: 'started' })
        assert.equal(seen[0].init.credentials, 'omit')
        assert.equal(seen[0].init.headers && 'Authorization' in (seen[0].init.headers as object), false)

        const down = (async () => {
            throw new Error('offline')
        }) as unknown as typeof fetch
        assert.doesNotThrow(() => reportMetric('x', 'completed', down))
        const sync = (() => {
            throw new Error('sync')
        }) as unknown as typeof fetch
        assert.doesNotThrow(() => reportMetric('x', 'completed', sync))
    })
})
