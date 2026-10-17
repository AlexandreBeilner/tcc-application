import { DailyApiError } from './api.ts'
import type { DailyApi } from './api.ts'
import type { CardEnv, CardView } from './cards.ts'
import { describeError } from './errors.ts'
import { append, el, formatCountdown, formatDate } from './dom.ts'
import type { StateKeeper } from './keeper.ts'
import { correctCards, emptyProgress, isComplete } from './progress.ts'
import { buildShareText, DEFAULT_SHARE_URL } from './share.ts'
import { createTimelineCard } from './timeline.ts'
import { createTriviaCard } from './trivia.ts'
import type { Completion, DailyGame, DailyStats, GameProgress, LearnMore, Mode } from './types.ts'
import { createWordCard } from './word.ts'

export interface MountOptions {
    api: DailyApi
    mode: Mode
    keeper: StateKeeper
    /** Relógio do navegador: só a contagem e o aviso de virada usam. Quem decide acerto e acesso é o servidor. */
    now?: () => number
    reducedMotion?: () => boolean
    /** Parte de `navigator` que o resultado usa (injetável para teste). */
    nav?: { share?: (data: { text: string }) => Promise<void>; clipboard?: { writeText(text: string): Promise<void> } }
    shareUrl?: string
    /** Para onde leva o "Saiba mais"; sem função (ou `null`) o link não aparece. */
    learnMoreHref?: (l: NonNullable<LearnMore>) => string | null
    /** O jogo fechou nesta sessão (`completion` só existe logado). A landing usa para o convite; o app, para o teatro de recompensa. */
    onComplete?: (info: { game: DailyGame; progress: GameProgress; completion: Completion | null }) => void
    onUnauthorized?: () => void
}

export interface DiarioController {
    destroy(): void
}

type TabId = 'word' | 'trivia' | 'timeline' | 'result'
const TAB_LABEL: Record<TabId, string> = { word: 'Palavra', trivia: 'Pergunta', timeline: 'Linha do tempo', result: 'Resultado' }
const CARD_IDS: Exclude<TabId, 'result'>[] = ['word', 'trivia', 'timeline']
const PAST_LIST = 30
const WARN_MS = 10 * 60 * 1000

interface GameView {
    el: HTMLElement
    tick(nowMs: number): void
    destroy(): void
}

export function mountDiario(root: HTMLElement, options: MountOptions): DiarioController {
    const doc = root.ownerDocument
    const win = doc.defaultView
    const { api, mode, keeper } = options
    const now = options.now ?? (() => Date.now())
    const reduced = options.reducedMotion ?? (() => !!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
    const shareUrl = options.shareUrl ?? DEFAULT_SHARE_URL

    let destroyed = false
    let todayGame: DailyGame | null = null
    let view: GameView | null = null
    let epoch = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()

    const later = (fn: () => void, ms: number) => {
        if (ms <= 0) return fn()
        const id = setTimeout(() => {
            timers.delete(id)
            if (!destroyed) fn()
        }, ms)
        timers.add(id)
    }

    root.classList.add('dg')
    const bannerText = el(doc, 'span', {}, 'Novo Diário disponível.')
    const bannerBtn = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary' }, 'Abrir o novo Diário')
    const banner = el(doc, 'div', { class: 'dg-banner', role: 'status', hidden: true }, bannerText, bannerBtn)
    const stage = el(doc, 'div', { class: 'dg-stage' })
    const statsBox = el(doc, 'section', { class: 'dg-stats', 'aria-label': 'Suas estatísticas', hidden: true })
    const pastBox = el(doc, 'section', { class: 'dg-past', 'aria-label': 'Dias anteriores', hidden: true })
    const note = el(doc, 'p', { class: 'dg-note' }, 'Novo Diário todo dia às 21h (horário de Brasília).')
    root.replaceChildren(banner, stage, statsBox, pastBox, note)
    bannerBtn.addEventListener('click', () => {
        banner.hidden = true
        void start()
    })

    // ---- mensagens e estados do palco ----

    function showMessage(text: string, retry?: () => void, extra?: Node): void {
        view?.destroy()
        view = null
        const box = el(doc, 'div', { class: 'dg-state', role: 'status' }, el(doc, 'p', {}, text))
        if (extra) box.appendChild(extra)
        if (retry) {
            const btn = el(doc, 'button', { type: 'button', class: 'dg-btn' }, 'Tentar de novo')
            btn.addEventListener('click', retry)
            box.appendChild(btn)
        }
        stage.replaceChildren(box)
    }

    function handleLoadError(e: unknown, retry: () => void): void {
        const { message, kind } = describeError(e)
        if (kind === 'unauthorized') options.onUnauthorized?.()
        showMessage(message, kind === 'unauthorized' ? undefined : retry)
    }

    // ---- carga ----

    async function start(): Promise<void> {
        const mine = ++epoch
        statsBox.hidden = true
        pastBox.hidden = true
        showMessage('Carregando o Diário...')
        let today
        try {
            today = await api.today()
        } catch (e) {
            if (mine === epoch && !destroyed) handleLoadError(e, () => void start())
            return
        }
        if (mine !== epoch || destroyed) return
        if (today.status === 'off') return showMessage('O Diário Selucra não está disponível agora.')
        if (today.status === 'scheduled')
            return showMessage(`O Diário Selucra estreia em ${formatDate(today.startDate)}. Volte nesse dia para jogar.`)
        todayGame = today.game
        await openGame(today.game, mine)
    }

    async function openGame(game: DailyGame, mine = epoch): Promise<void> {
        try {
            const saved = await keeper.load(game.number, todayGame?.number ?? game.number)
            if (mine !== epoch || destroyed) return
            build(game, saved ?? emptyProgress(game))
        } catch (e) {
            if (mine === epoch && !destroyed) handleLoadError(e, () => void openGame(game))
        }
        if (mine === epoch && !destroyed) void refreshAside()
    }

    async function openPast(n: number): Promise<void> {
        const mine = ++epoch
        showMessage('Carregando...')
        try {
            const game = await api.game(n)
            if (mine !== epoch || destroyed) return
            await openGame(game, mine)
        } catch (e) {
            if (mine === epoch && !destroyed) {
                const text =
                    e instanceof DailyApiError && e.code === 'not_found'
                        ? 'Esse dia não está disponível para jogar.'
                        : describeError(e).message
                const back = el(doc, 'button', { type: 'button', class: 'dg-btn' }, 'Voltar para o jogo de hoje')
                back.addEventListener('click', () => void start())
                showMessage(text, undefined, back)
            }
        }
    }

    // ---- o jogo ----

    function build(game: DailyGame, initial: GameProgress): void {
        view?.destroy()
        let progress = initial
        let completion: Completion | null = null
        let announced = isComplete(initial)
        let tab: TabId = CARD_IDS.find((id) => !cardDone(progress, id)) ?? 'result'
        const practice = !game.isToday

        const msg = el(doc, 'p', { class: 'dg-msg', role: 'status' })
        const say = (text: string) => {
            msg.textContent = text
        }
        const warn = el(doc, 'p', { class: 'dg-warn', hidden: true })

        const env: CardEnv = {
            doc,
            game,
            mode,
            api,
            progress: () => progress,
            commit(next, comp, settleMs) {
                progress = next
                if (comp) completion = comp
                void keeper.save(game, next)
                later(() => {
                    paintTabs()
                    if (isComplete(progress) && !announced) {
                        announced = true
                        void refreshAside()
                        options.onComplete?.({ game, progress, completion })
                        paintResult()
                    }
                }, settleMs)
            },
            fail(e) {
                const { message, kind } = describeError(e)
                if (kind === 'unauthorized') options.onUnauthorized?.()
                if (kind === 'resync') void resync()
                return message
            },
            say,
            reduced,
            learnMoreHref: (l) => options.learnMoreHref?.(l) ?? null,
            later,
            nextLabel: () => nextLabel(),
            next: () => goNext(),
        }

        const cards: Record<Exclude<TabId, 'result'>, CardView> = {
            word: createWordCard(env),
            trivia: createTriviaCard(env),
            timeline: createTimelineCard(env),
        }
        const resultPanel = el(doc, 'div', { class: 'dg-result' })

        // abas
        const tabEls = {} as Record<TabId, HTMLButtonElement>
        const panels = {} as Record<TabId, HTMLElement>
        const tablist = el(doc, 'div', { class: 'dg-tabs', role: 'tablist', 'aria-label': 'Cartões do dia' })
        const ids: TabId[] = ['word', 'trivia', 'timeline', 'result']
        for (const id of ids) {
            const btn = el(doc, 'button', {
                type: 'button',
                class: 'dg-tab',
                role: 'tab',
                id: `dg-tab-${game.number}-${id}`,
                'aria-controls': `dg-panel-${game.number}-${id}`,
            })
            btn.addEventListener('click', () => select(id))
            btn.addEventListener('keydown', (ev) => {
                const visible = ids.filter((i) => !tabEls[i].hidden)
                const at = visible.indexOf(id)
                const target =
                    ev.key === 'ArrowRight'
                        ? visible[(at + 1) % visible.length]
                        : ev.key === 'ArrowLeft'
                          ? visible[(at - 1 + visible.length) % visible.length]
                          : null
                if (target) {
                    ev.preventDefault()
                    select(target)
                    tabEls[target].focus()
                }
            })
            tabEls[id] = btn
            tablist.appendChild(btn)
            const panel = el(
                doc,
                'section',
                { class: 'dg-panel', role: 'tabpanel', id: `dg-panel-${game.number}-${id}`, 'aria-labelledby': btn.id },
                id === 'result' ? resultPanel : cards[id].el,
            )
            panels[id] = panel
        }

        function cardState(id: Exclude<TabId, 'result'>): { glyph: string; text: string } {
            if (!cardDone(progress, id)) return { glyph: '○', text: 'pendente' }
            const ok =
                id === 'word'
                    ? progress.word.solved
                    : id === 'trivia'
                      ? progress.trivia.answered && progress.trivia.correct
                      : progress.timeline.answered && progress.timeline.correct
            return ok ? { glyph: '✓', text: 'certo' } : { glyph: '✗', text: 'errado' }
        }

        function paintTabs(): void {
            for (const id of ids) {
                const btn = tabEls[id]
                btn.replaceChildren()
                if (id === 'result') {
                    btn.hidden = !isComplete(progress)
                    btn.append(TAB_LABEL[id])
                } else {
                    const s = cardState(id)
                    btn.append(
                        el(doc, 'span', { class: 'dg-tab-glyph', 'aria-hidden': 'true' }, s.glyph),
                        TAB_LABEL[id],
                        el(doc, 'span', { class: 'dg-sr' }, ` (${s.text})`),
                    )
                    btn.dataset.state = s.text
                }
                const active = id === tab
                btn.setAttribute('aria-selected', String(active))
                btn.tabIndex = active ? 0 : -1
                panels[id].hidden = !active
            }
        }

        function select(id: TabId): void {
            if (id === 'result' && !isComplete(progress)) return
            tab = id
            paintTabs()
        }

        function nextLabel(): string {
            const next = CARD_IDS.find((id) => !cardDone(progress, id))
            return next ? `Próximo: ${TAB_LABEL[next]}` : 'Ver o resultado'
        }

        function goNext(): void {
            const next = CARD_IDS.find((id) => !cardDone(progress, id))
            if (next) select(next)
            else select('result')
        }

        // resultado
        let countEl: HTMLElement | null = null
        function paintResult(): void {
            resultPanel.replaceChildren()
            countEl = null
            if (!isComplete(progress)) return
            const w = progress.word
            const line = (label: string, ok: boolean, detail: string) =>
                el(
                    doc,
                    'li',
                    { 'data-ok': String(ok) },
                    el(doc, 'span', { class: 'dg-res-mark', 'aria-hidden': 'true' }, ok ? '✓' : '✗'),
                    el(doc, 'strong', {}, label),
                    ` ${detail}`,
                    el(doc, 'span', { class: 'dg-sr' }, ok ? ' (certo)' : ' (errado)'),
                )
            const total = correctCards(progress)
            const text = buildShareText(game, progress, shareUrl)
            const pre = el(doc, 'pre', { class: 'dg-share', tabindex: '0', 'aria-label': 'Texto para compartilhar' }, text)
            const status = el(doc, 'p', { class: 'dg-msg', role: 'status' })
            const buttons = el(doc, 'div', { class: 'dg-actions' })
            const nav = options.nav ?? (win?.navigator as unknown as MountOptions['nav'])
            const copy = async () => {
                try {
                    if (!nav?.clipboard) throw new Error('sem área de transferência')
                    await nav.clipboard.writeText(text)
                    status.textContent = 'Resultado copiado.'
                } catch {
                    const range = doc.createRange()
                    range.selectNodeContents(pre)
                    const selection = win?.getSelection?.()
                    selection?.removeAllRanges()
                    selection?.addRange(range)
                    status.textContent = 'Não foi possível copiar sozinho. O texto está selecionado, copie com Ctrl+C.'
                }
            }
            if (nav?.share) {
                const share = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary' }, 'Compartilhar')
                share.addEventListener('click', async () => {
                    try {
                        await nav.share!({ text })
                    } catch (e) {
                        if ((e as { name?: string } | null)?.name !== 'AbortError') await copy()
                    }
                })
                buttons.appendChild(share)
            }
            const copyBtn = el(
                doc,
                'button',
                { type: 'button', class: nav?.share ? 'dg-btn' : 'dg-btn dg-btn-primary' },
                'Copiar resultado',
            )
            copyBtn.addEventListener('click', () => void copy())
            buttons.appendChild(copyBtn)
            countEl = el(doc, 'span', { class: 'dg-count' })
            append(resultPanel, [
                el(
                    doc,
                    'h3',
                    { class: 'dg-res-title' },
                    practice ? `Diário #${game.number} concluído` : `Diário de hoje concluído: ${total} de 3 certos`,
                ),
                el(
                    doc,
                    'ul',
                    { class: 'dg-res-list' },
                    line('Palavra', w.solved, w.solved ? `em ${w.guesses.length} de ${game.cards.word.maxAttempts}` : 'não resolvida'),
                    line('Pergunta', progress.trivia.answered && progress.trivia.correct, ''),
                    line('Linha do tempo', progress.timeline.answered && progress.timeline.correct, ''),
                ),
                completion && completion.xpAwarded > 0 ? el(doc, 'p', { class: 'dg-xp' }, `+${completion.xpAwarded} XP`) : null,
                practice ? el(doc, 'p', { class: 'dg-hint' }, 'Dia anterior: não vale XP nem sequência.') : null,
                pre,
                buttons,
                status,
                el(doc, 'p', { class: 'dg-next' }, 'Próximo Diário em ', countEl),
            ])
            tick(now())
        }

        function tick(nowMs: number): void {
            if (!todayGame) return
            const remaining = Date.parse(todayGame.nextGameAt) - nowMs
            if (countEl) countEl.textContent = remaining > 0 ? formatCountdown(remaining) : 'agora'
            const risk = mode === 'app' && game.isToday && !isComplete(progress) && remaining > 0 && remaining <= WARN_MS
            warn.hidden = !risk
            if (risk)
                warn.textContent = `Faltam ${formatCountdown(remaining).slice(3)} para o próximo Diário. O XP do dia só vale se você concluir antes.`
        }

        // resincroniza com o servidor (cartão já respondido em outra aba ou aparelho)
        async function resync(): Promise<void> {
            try {
                const saved = await keeper.load(game.number, todayGame?.number ?? game.number)
                if (saved && !destroyed) build(game, saved)
            } catch {
                // a mensagem do erro original já foi mostrada
            }
        }

        const header = el(
            doc,
            'header',
            { class: 'dg-head' },
            el(doc, 'h2', { class: 'dg-title' }, 'Diário Selucra'),
            el(
                doc,
                'p',
                { class: 'dg-sub' },
                `#${game.number} · ${formatDate(game.date)}`,
                practice ? el(doc, 'span', { class: 'dg-badge' }, 'Dia anterior, sem XP') : null,
            ),
        )
        const wrap = el(doc, 'div', { class: 'dg-game' }, header)
        if (practice) {
            const back = el(doc, 'button', { type: 'button', class: 'dg-btn dg-link-btn' }, 'Voltar para o jogo de hoje')
            back.addEventListener('click', () => void start())
            wrap.appendChild(back)
        }
        wrap.append(warn, tablist, msg, ...ids.map((id) => panels[id]))
        paintTabs()
        paintResult()

        const onKey = (e: KeyboardEvent) => {
            if (tab !== 'word') return
            const t = e.target as HTMLElement | null
            if (
                t &&
                (t.closest?.('input, textarea, select, [contenteditable="true"]') ||
                    (t.getAttribute?.('role') === 'tab' && e.key.startsWith('Arrow')))
            )
                return
            if (cards.word.onKey?.(e)) e.preventDefault()
        }
        doc.addEventListener('keydown', onKey)

        stage.replaceChildren(wrap)
        view = {
            el: wrap,
            tick,
            destroy() {
                doc.removeEventListener('keydown', onKey)
            },
        }
        tick(now())
    }

    function cardDone(p: GameProgress, id: Exclude<TabId, 'result'>): boolean {
        return id === 'word' ? p.word.finished : id === 'trivia' ? p.trivia.answered : p.timeline.answered
    }

    // ---- estatísticas e dias anteriores ----

    async function refreshAside(): Promise<void> {
        if (!todayGame) return
        const mine = epoch
        const today = todayGame.number
        let stats: DailyStats | null = null
        let done: number[] = []
        try {
            stats = await keeper.stats(today)
        } catch {
            stats = null
        }
        try {
            done = (await keeper.done?.()) ?? []
        } catch {
            done = []
        }
        if (destroyed || mine !== epoch) return
        paintStats(stats)
        paintPast(today, new Set(done))
    }

    function paintStats(stats: DailyStats | null): void {
        statsBox.replaceChildren()
        statsBox.hidden = !stats || stats.games === 0
        if (!stats || stats.games === 0) return
        const cell = (value: string, label: string) =>
            el(doc, 'div', { class: 'dg-stat' }, el(doc, 'strong', {}, value), el(doc, 'span', {}, label))
        const maxCount = Math.max(1, ...Object.values(stats.wordAttempts.distribution))
        const dist = el(doc, 'ol', { class: 'dg-dist', 'aria-label': 'Acertos da palavra por número de tentativas' })
        for (const [tries, n] of Object.entries(stats.wordAttempts.distribution)) {
            dist.appendChild(
                el(
                    doc,
                    'li',
                    {},
                    el(doc, 'span', { class: 'dg-dist-n' }, tries),
                    el(doc, 'span', { class: 'dg-dist-bar', style: `width:${Math.max(6, Math.round((n / maxCount) * 100))}%` }, String(n)),
                ),
            )
        }
        statsBox.append(
            el(doc, 'h3', {}, 'Suas estatísticas'),
            el(
                doc,
                'div',
                { class: 'dg-stat-row' },
                cell(String(stats.games), 'jogos'),
                cell(String(stats.currentStreak), 'sequência'),
                cell(String(stats.longestStreak), 'maior sequência'),
                cell(`${stats.word.accuracy}%`, 'palavra certa'),
            ),
            dist,
        )
    }

    function paintPast(today: number, done: Set<number>): void {
        pastBox.replaceChildren()
        const numbers: number[] = []
        for (let n = today - 1; n >= 1 && numbers.length < PAST_LIST; n--) numbers.push(n)
        pastBox.hidden = numbers.length === 0
        if (!numbers.length) return
        const list = el(doc, 'ul', { class: 'dg-past-list' })
        for (const n of numbers) {
            const btn = el(
                doc,
                'button',
                { type: 'button', class: 'dg-past-btn' },
                `Diário #${n}`,
                done.has(n) ? el(doc, 'span', { class: 'dg-past-done' }, ' ✓ feito') : null,
            )
            btn.addEventListener('click', () => void openPast(n))
            list.appendChild(el(doc, 'li', {}, btn))
        }
        pastBox.append(
            el(
                doc,
                'details',
                {},
                el(doc, 'summary', {}, 'Jogar dias anteriores'),
                el(doc, 'p', { class: 'dg-hint' }, 'Dias anteriores não valem XP nem sequência.'),
                list,
            ),
        )
    }

    // ---- relógio: contagem e virada do dia ----

    const checkTurn = () => {
        const nowMs = now()
        view?.tick(nowMs)
        if (todayGame && nowMs >= Date.parse(todayGame.nextGameAt)) banner.hidden = false
    }
    const interval = setInterval(checkTurn, 1000)
    const onVisible = () => !doc.hidden && checkTurn()
    doc.addEventListener('visibilitychange', onVisible)

    void start()

    return {
        destroy() {
            destroyed = true
            clearInterval(interval)
            for (const id of timers) clearTimeout(id)
            timers.clear()
            doc.removeEventListener('visibilitychange', onVisible)
            view?.destroy()
            root.replaceChildren()
            root.classList.remove('dg')
        },
    }
}
