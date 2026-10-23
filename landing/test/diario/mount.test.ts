import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { createLocalKeeper, createServerKeeper, mountDiario, STORAGE_KEY } from '../../src/diario/index.ts'
import type { DiarioController, MountOptions } from '../../src/diario/index.ts'
import { makeApi, makeDom, makeGame, memoryStorage } from './fixtures.ts'
import type { FakeApi } from './fixtures.ts'

const live: DiarioController[] = []
afterEach(() => {
    while (live.length) live.pop()!.destroy()
})

function setup(
    opts: { api?: FakeApi; mode?: 'publico' | 'app'; storage?: Storage | null; now?: () => number; extra?: Partial<MountOptions> } = {},
) {
    const dom = makeDom()
    const api = opts.api ?? makeApi(makeGame())
    const mode = opts.mode ?? 'publico'
    const storage = opts.storage === undefined ? memoryStorage() : opts.storage
    const keeper = mode === 'app' ? createServerKeeper(api) : createLocalKeeper({ getStorage: () => storage, now: opts.now })
    const ctl = mountDiario(dom.root, {
        api,
        mode,
        keeper,
        now: opts.now ?? (() => Date.parse('2026-12-17T15:00:00Z')),
        reducedMotion: () => true,
        ...opts.extra,
    })
    live.push(ctl)
    return { ...dom, api, storage, ctl }
}

describe('Palavra do dia', () => {
    it('desenha o jogo, aceita teclado físico sem acento e pinta o que o servidor devolveu', async () => {
        const t = setup()
        await t.flush()
        assert.equal(t.$$('.dg-row').length, 6)
        assert.equal(t.$$('.dg-row')[0].children.length, 5)
        t.type('açoes')
        assert.equal(t.rowText(0), 'ACOES')
        t.key('Enter')
        await t.flush()
        assert.deepEqual(t.api.calls.guess, [{ guess: 'ACOES', attempt: 1 }])
        assert.deepEqual(t.rowStates(0), ['correct', 'correct', 'correct', 'correct', 'correct'])
        assert.match(t.$('.dg-reveal')!.textContent!, /AÇÕES/)
    })

    it('letra repetida: mostra exatamente as cores devolvidas, com símbolo próprio por estado', async () => {
        const t = setup()
        await t.flush()
        t.type('aassa')
        t.key('Enter')
        await t.flush()
        // resposta ACOES: A correto, segundo A fora do lugar? só há um A na resposta, então o resto fica ausente
        assert.deepEqual(
            t.rowStates(0),
            ['correct', 'absent', 'present', 'absent', 'absent'].map((s, i) => (i === 2 ? 'present' : s)),
        )
        const tile = t.$$('.dg-row')[0].children[0] as HTMLElement
        assert.match(tile.getAttribute('aria-label')!, /letra certa no lugar certo/)
        assert.equal(t.$$('.dg-key').find((k) => k.dataset.key === 'S')!.dataset.state, 'present')
    })

    it('palavra não aceita: avisa, não gasta tentativa e mantém as letras digitadas', async () => {
        const t = setup()
        await t.flush()
        t.type('zzzzz')
        t.key('Enter')
        await t.flush()
        assert.match(t.$('.dg-msg')!.textContent!, /não está na lista/)
        assert.equal(t.rowText(0), 'ZZZZZ')
        t.key('Backspace')
        t.type('carro')
        t.key('Backspace')
        t.key('Backspace')
        t.key('Backspace')
        t.key('Backspace')
        t.key('Backspace')
        t.type('carro')
        t.key('Enter')
        await t.flush()
        // a primeira tentativa válida segue sendo a 1
        assert.equal(t.api.calls.guess.at(-1)!.attempt, 1)
        assert.equal(t.rowText(0), 'CARRO')
    })

    it('palpite curto não chama a API; o teclado na tela digita e envia', async () => {
        const t = setup()
        await t.flush()
        t.type('ac')
        t.key('Enter')
        assert.equal(t.api.calls.guess.length, 0)
        assert.match(t.$('.dg-msg')!.textContent!, /Faltam letras/)
        for (const ch of 'OES') t.click(t.$$('.dg-key').find((k) => k.dataset.key === ch)!)
        t.click(t.$$('.dg-key').find((k) => k.dataset.key === '↵')!)
        await t.flush()
        assert.equal(t.api.calls.guess.length, 1)
    })

    it('casa selecionada: toque ou setas escolhem onde a letra entra, sem preencher as anteriores', async () => {
        const t = setup()
        await t.flush()
        const tiles = () => Array.from(t.$$('.dg-row')[0].children) as HTMLElement[]
        assert.ok(tiles()[0].hasAttribute('data-cursor'))
        t.click(tiles()[3])
        assert.ok(tiles()[3].hasAttribute('data-cursor'))
        assert.match(tiles()[3].getAttribute('aria-label')!, /selecionada/)
        t.type('e')
        assert.equal(t.rowText(0), 'E')
        assert.equal(tiles()[3].textContent, 'E')
        t.type('s')
        // sem casa vazia à direita, volta para a primeira vazia
        assert.ok(tiles()[0].hasAttribute('data-cursor'))
        t.type('aco')
        assert.equal(t.rowText(0), 'ACOES')
        // seta para a esquerda e Backspace apagam a casa selecionada; digitar sobrescreve
        t.key('ArrowLeft')
        t.key('Backspace')
        assert.equal(tiles()[2].textContent, '')
        t.key('Enter')
        assert.equal(t.api.calls.guess.length, 0)
        t.type('o')
        t.key('Enter')
        await t.flush()
        assert.deepEqual(t.api.calls.guess, [{ guess: 'ACOES', attempt: 1 }])
        // linha enviada não tem mais casa selecionada
        assert.ok(!tiles().some((tile) => tile.hasAttribute('data-cursor')))
    })

    it('seis tentativas erradas: revela a palavra com acento', async () => {
        const t = setup()
        await t.flush()
        for (let i = 0; i < 6; i++) {
            t.type('carro')
            t.key('Enter')
            await t.flush()
        }
        assert.match(t.$('.dg-reveal')!.textContent!, /A palavra era AÇÕES/)
        const tab = t.$$('.dg-tab')[0]
        assert.equal(tab.dataset.state, 'errado')
    })
})

async function playAll(t: ReturnType<typeof setup>) {
    await t.flush()
    t.type('acoes')
    t.key('Enter')
    await t.flush()
    t.click(t.button('Próximo: Pergunta')!)
    t.click(t.$$('.dg-option')[1])
    t.click(t.button('Confirmar resposta')!)
    await t.flush()
    t.click(t.button('Ver o resultado')!)
}

describe('Pergunta do dia', () => {
    it('são dois cartões e o resultado; a Linha do tempo saiu (DI18)', async () => {
        const t = setup()
        await t.flush()
        const tabs = t.$$('.dg-tab').map((b) => b.textContent!.replace(/ \(.*\)$/, '').replace(/^[○✓✗]/, ''))
        assert.deepEqual(tabs, ['Palavra', 'Pergunta', 'Resultado'])
        assert.equal(t.$('.dg-tl'), null)
    })

    it('pergunta: escolhe, confirma e mostra gabarito, explicação e fonte', async () => {
        const t = setup()
        await t.flush()
        t.click(t.$$('.dg-tab')[1])
        t.click(t.$$('.dg-option')[0])
        t.click(t.button('Confirmar resposta')!)
        await t.flush()
        assert.deepEqual(t.api.calls.trivia, [0])
        assert.equal(t.$$('.dg-option')[0].dataset.state, 'wrong')
        assert.equal(t.$$('.dg-option')[1].dataset.state, 'right')
        assert.match(t.$('.dg-trivia .dg-after')!.textContent!, /IPCA/)
        assert.match(t.$('.dg-trivia .dg-after')!.textContent!, /Fonte: Banco Central/)
    })
})

describe('Resultado', () => {
    it('compartilha por texto sem resposta e sem valor em R$; copia quando não há Web Share', async () => {
        let copied = ''
        const t = setup({ extra: { nav: { clipboard: { writeText: async (s) => void (copied = s) } } } })
        await playAll(t)
        const share = t.$('.dg-share')!.textContent!
        assert.match(share, /^Diário Selucra #47\n/)
        assert.match(share, /🟩🟩🟩🟩🟩\npalavra em 1\n❓ ✅\nselucra\.com\.br\/diario$/)
        assert.doesNotMatch(share, /AÇÕES|ACOES|R\$|IPCA/i)
        assert.equal(t.button('Compartilhar'), null)
        t.click(t.button('Copiar resultado')!)
        await t.flush()
        assert.equal(copied, share)
        assert.match(t.$('.dg-next')!.textContent!, /Próximo Diário em 09:00:00/)
    })

    it('usa a Web Share API quando existe e cai na cópia se ela falhar', async () => {
        const shared: string[] = []
        let copied = ''
        const t = setup({
            extra: {
                nav: {
                    share: async ({ text }) => {
                        shared.push(text)
                        throw Object.assign(new Error('x'), { name: 'NotAllowedError' })
                    },
                    clipboard: { writeText: async (s) => void (copied = s) },
                },
            },
        })
        await playAll(t)
        t.click(t.button('Compartilhar')!)
        await t.flush()
        assert.equal(shared.length, 1)
        assert.equal(copied, shared[0])
    })

    it('sem clipboard nem share, deixa o texto selecionado e explica', async () => {
        const t = setup({ extra: { nav: {} } })
        await playAll(t)
        t.click(t.button('Copiar resultado')!)
        await t.flush()
        assert.match(t.$('.dg-result .dg-msg')!.textContent!, /selecionado/)
    })

    it('avisa o fim do jogo uma vez (convite da landing / celebração do app)', async () => {
        let done = 0
        const t = setup({ extra: { onComplete: () => void done++ } })
        await playAll(t)
        assert.equal(done, 1)
    })
})

describe('aviso de início (DI.7.1)', () => {
    it('avisa a primeira jogada uma vez, e reabrir um jogo começado não avisa de novo', async () => {
        const storage = memoryStorage()
        let started = 0
        const first = setup({ storage, extra: { onStart: () => void started++ } })
        await first.flush()
        assert.equal(started, 0)
        first.type('carro')
        first.key('Enter')
        await first.flush()
        assert.equal(started, 1)
        first.type('bolsa')
        first.key('Enter')
        await first.flush()
        assert.equal(started, 1)
        first.ctl.destroy()

        const again = setup({ storage, extra: { onStart: () => void started++ } })
        await again.flush()
        again.type('prazo')
        again.key('Enter')
        await again.flush()
        assert.equal(started, 1)
    })
})

describe('estado salvo no navegador', () => {
    it('recarregar no mesmo dia mostra o jogo como estava, sem chamar a API de novo', async () => {
        const storage = memoryStorage()
        const t = setup({ storage })
        await t.flush()
        t.type('carro')
        t.key('Enter')
        await t.flush()
        t.click(t.$$('.dg-tab')[1])
        t.click(t.$$('.dg-option')[2])
        t.click(t.button('Confirmar resposta')!)
        await t.flush()
        t.ctl.destroy()

        const again = setup({ storage })
        await again.flush()
        assert.equal(again.api.calls.guess.length, 0)
        assert.equal(again.api.calls.trivia.length, 0)
        assert.equal(again.rowText(0), 'CARRO')
        assert.notEqual(again.rowStates(0)[0], 'empty')
        // abre direto no cartão que está em andamento (palavra)
        assert.equal(again.$$('.dg-tab')[1].dataset.state, 'errado')
        again.click(again.$$('.dg-tab')[1])
        assert.equal(again.$$('.dg-option')[2].dataset.state, 'wrong')
        assert.equal(again.$$('.dg-option')[1].dataset.state, 'right')
    })

    it('dia seguinte começa limpo e as estatísticas continuam', async () => {
        const storage = memoryStorage()
        const day1 = setup({ storage, now: () => Date.parse('2026-12-17T15:00:00Z') })
        await playAll(day1)
        day1.ctl.destroy()

        const next = makeApi(makeGame(48))
        const day2 = setup({ storage, api: next, now: () => Date.parse('2026-12-18T15:00:00Z') })
        await day2.flush()
        assert.equal(day2.rowText(0), '')
        assert.equal(day2.$$('.dg-tab')[0].dataset.state, 'pendente')
        const nums = day2.$$('.dg-stat strong').map((n) => n.textContent)
        assert.deepEqual(nums.slice(0, 3), ['1', '1', '1']) // 1 jogo, sequência 1, maior 1
        day2.ctl.destroy()
        assert.ok(JSON.parse(storage.getItem(STORAGE_KEY)!).games['47'])
    })

    it('estado corrompido, de versão desconhecida ou com jogo futuro é ignorado sem erro', async () => {
        for (const bad of ['{não é json', JSON.stringify({ v: 99, games: {}, stats: {} }), JSON.stringify([1, 2]), 'null']) {
            const t = setup({ storage: memoryStorage({ [STORAGE_KEY]: bad }) })
            await t.flush()
            assert.equal(t.$$('.dg-row').length, 6, bad)
            assert.equal(t.rowText(0), '')
        }
        // um jogo salvo com número maior que o de hoje (relógio ou dado adulterado) não aparece
        const seed = setup()
        await seed.flush()
        seed.type('carro')
        seed.key('Enter')
        await seed.flush()
        const saved = JSON.parse(seed.storage!.getItem(STORAGE_KEY)!)
        saved.games['99'] = { ...saved.games['47'], number: 99 }
        const t = setup({ storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) }) })
        await t.flush()
        assert.equal(t.rowText(0), 'CARRO') // o de hoje continua
        assert.equal(t.$$('.dg-past-btn').length, 30)
    })

    it('sem localStorage o jogo funciona, só não lembra depois de recarregar', async () => {
        const t = setup({ storage: null })
        await t.flush()
        t.type('carro')
        t.key('Enter')
        await t.flush()
        assert.equal(t.rowText(0), 'CARRO')
        const throwing = setup({ storage: null })
        await throwing.flush()
        assert.equal(throwing.rowText(0), '')
    })

    it('storage que lança em todo acesso não quebra o jogo', async () => {
        const dom = makeDom()
        const api = makeApi(makeGame())
        const boom = () => {
            throw new Error('bloqueado')
        }
        const keeper = createLocalKeeper({ getStorage: boom })
        live.push(mountDiario(dom.root, { api, mode: 'publico', keeper, reducedMotion: () => true }))
        await dom.flush()
        dom.type('carro')
        dom.key('Enter')
        await dom.flush()
        assert.equal(dom.rowText(0), 'CARRO')
    })
})

describe('virada do dia e dias anteriores', () => {
    it('na virada avisa "Novo Diário disponível" sem apagar o jogo da tela, e abre o novo ao clicar', async () => {
        let clock = Date.parse('2026-12-17T23:59:00Z')
        const api = makeApi(makeGame())
        const t = setup({ api, now: () => clock })
        await t.flush()
        t.type('carro')
        t.key('Enter')
        await t.flush()
        assert.equal(t.$('.dg-banner')!.hidden, true)
        clock = Date.parse('2026-12-18T00:00:01Z')
        t.window.document.dispatchEvent(new t.window.Event('visibilitychange'))
        assert.equal(t.$('.dg-banner')!.hidden, false)
        assert.match(t.$('.dg-banner')!.textContent!, /Novo Diário disponível/)
        assert.equal(t.rowText(0), 'CARRO')
        api.setToday(makeGame(48))
        t.click(t.button('Abrir o novo Diário')!)
        await t.flush()
        assert.equal(t.rowText(0), '')
        assert.match(t.$('.dg-sub')!.textContent!, /#48/)
    })

    it('abre um dia anterior sem XP e volta ao de hoje; dia indisponível mostra aviso', async () => {
        const t = setup({ api: makeApi(makeGame(47)) })
        await t.flush()
        t.window.document.querySelector('details')!.open = true
        t.click(t.$$('.dg-past-btn').find((b) => b.textContent!.includes('#46'))!)
        await t.flush()
        assert.deepEqual(t.api.calls.game, [46])
        assert.match(t.$('.dg-badge')!.textContent!, /sem XP/)
        t.click(t.button('Voltar para o jogo de hoje')!)
        await t.flush()
        assert.match(t.$('.dg-sub')!.textContent!, /#47/)
        assert.equal(t.$('.dg-badge'), null)
    })

    it('hoje, antes da estreia e desligado mostram o aviso certo', async () => {
        for (const [reply, expected] of [
            [{ status: 'off' }, /não está disponível/],
            [{ status: 'scheduled', startDate: '2026-11-03', startsAt: '2026-11-03T00:00:00.000Z' }, /estreia em 3 de novembro/],
        ] as const) {
            const api = makeApi(makeGame())
            ;(api as unknown as { today: () => Promise<unknown> }).today = async () => reply
            const t = setup({ api })
            await t.flush()
            assert.match(t.$('.dg-state')!.textContent!, expected)
            assert.equal(t.$('.dg-grid'), null)
        }
    })
})

describe('modo app (servidor é a fonte)', () => {
    it('não manda attempt, não usa localStorage e redesenha pelo /me', async () => {
        const storage = memoryStorage()
        const api = makeApi(makeGame(), { logged: true })
        const t = setup({ api, mode: 'app', storage })
        await t.flush()
        t.type('carro')
        t.key('Enter')
        await t.flush()
        assert.deepEqual(api.calls.guess, [{ guess: 'CARRO', attempt: undefined }])
        assert.equal(storage.getItem(STORAGE_KEY), null)
        t.ctl.destroy()
        const again = setup({ api, mode: 'app', storage })
        await again.flush()
        assert.equal(again.rowText(0), 'CARRO')
        assert.deepEqual(api.calls.me, [47, 47])
        // estatísticas vêm do servidor
        assert.equal(again.$$('.dg-stat strong')[0].textContent, '3')
    })

    it('409 already_answered relê o estado do servidor', async () => {
        const api = makeApi(makeGame(), { logged: true })
        const t = setup({ api, mode: 'app' })
        await t.flush()
        // outra aba responde a pergunta
        await api.trivia(47, 1)
        t.click(t.$$('.dg-tab')[1])
        t.click(t.$$('.dg-option')[0])
        t.click(t.button('Confirmar resposta')!)
        await t.flush()
        assert.equal(api.calls.me.length, 2)
        t.click(t.$$('.dg-tab')[1])
        assert.equal(t.$$('.dg-option')[1].dataset.state, 'right')
        assert.equal(t.$$('.dg-option')[0].disabled, true)
    })

    it('token inválido (401) avisa o app e não tenta de novo sozinho', async () => {
        let unauthorized = 0
        const api = makeApi(makeGame(), { logged: true })
        api.me = async () => {
            const { DailyApiError } = await import('../../src/diario/api.ts')
            throw new DailyApiError(401, null, null, null)
        }
        const t = setup({ api, mode: 'app', extra: { onUnauthorized: () => void unauthorized++ } })
        await t.flush()
        assert.equal(unauthorized, 1)
        assert.match(t.$('.dg-state')!.textContent!, /sessão expirou/)
        assert.equal(t.button('Tentar de novo'), null)
    })

    it('mostra o aviso de XP nos últimos minutos antes da virada e o XP ganho no resultado', async () => {
        const api = makeApi(makeGame(), { logged: true })
        const orig = api.trivia
        api.trivia = async (n, c) => ({ ...(await orig(n, c)), completion: { correctCards: 2, xpAwarded: 50 } })
        const t = setup({ api, mode: 'app', now: () => Date.parse('2026-12-17T23:55:00Z') })
        await t.flush()
        t.window.document.dispatchEvent(new t.window.Event('visibilitychange'))
        assert.equal(t.$('.dg-warn')!.hidden, false)
        assert.match(t.$('.dg-warn')!.textContent!, /Faltam 05:00/)
        await playAll(t)
        assert.equal(t.$('.dg-xp')!.textContent, '+50 XP')
        assert.equal(t.$('.dg-warn')!.hidden, true)
    })
})

describe('erros de rede', () => {
    it('falha ao carregar oferece tentar de novo', async () => {
        const api = makeApi(makeGame())
        const { DailyApiError } = await import('../../src/diario/api.ts')
        let fail = true
        const ok = api.today
        api.today = async () => {
            if (fail) throw new DailyApiError(0, 'network', null, null)
            return ok()
        }
        const t = setup({ api })
        await t.flush()
        assert.match(t.$('.dg-state')!.textContent!, /Sem conexão/)
        fail = false
        t.click(t.button('Tentar de novo')!)
        await t.flush()
        assert.equal(t.$$('.dg-row').length, 6)
    })
})
