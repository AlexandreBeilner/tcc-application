import { DailyApiError } from './api.ts'
import type { CardEnv, CardView } from './cards.ts'
import { LEARN_MORE_LABEL } from './cards.ts'
import { describeInvalidGuess } from './errors.ts'
import { el, normalizeLetters } from './dom.ts'
import { applyGuess } from './progress.ts'
import type { LetterState } from './types.ts'

const STATE_LABEL: Record<LetterState, string> = {
    correct: 'letra certa no lugar certo',
    present: 'letra certa no lugar errado',
    absent: 'letra que não está na palavra',
}
const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '↵ZXCVBNM⌫']
const FLIP_STEP_MS = 250
const FLIP_MS = 500

export function createWordCard(env: CardEnv): CardView {
    const { doc, game } = env
    const { length, maxAttempts } = game.cards.word
    // casas da tentativa atual ('' = vazia) e a casa selecionada, como no Termo: dá para escrever em qualquer casa
    let slots: string[] = Array(length).fill('')
    let cursor = 0
    let busy = false

    const rows: HTMLElement[] = []
    const grid = el(doc, 'div', { class: 'dg-grid', role: 'group', 'aria-label': 'Tentativas da palavra do dia', style: `--len:${length}` })
    for (let r = 0; r < maxAttempts; r++) {
        const row = el(doc, 'div', { class: 'dg-row', role: 'group', 'aria-label': `Tentativa ${r + 1}` })
        for (let c = 0; c < length; c++) row.appendChild(el(doc, 'span', { class: 'dg-tile', role: 'img' }))
        rows.push(row)
        grid.appendChild(row)
    }
    grid.addEventListener('click', (ev) => {
        const tile = (ev.target as HTMLElement | null)?.closest?.('.dg-tile')
        const w = env.progress().word
        if (!tile || busy || w.finished || tile.parentElement !== rows[w.guesses.length]) return
        cursor = Array.prototype.indexOf.call(tile.parentElement.children, tile)
        paintRow(w.guesses.length, slots)
    })

    const keys = new Map<string, HTMLButtonElement>()
    const keyboard = el(doc, 'div', { class: 'dg-kb', role: 'group', 'aria-label': 'Teclado' })
    for (const letters of KEY_ROWS) {
        const rowEl = el(doc, 'div', { class: 'dg-kb-row' })
        for (const ch of letters) {
            const label = ch
            const btn = el(
                doc,
                'button',
                { type: 'button', class: ch === '↵' || ch === '⌫' ? 'dg-key dg-key-wide' : 'dg-key', 'data-key': ch },
                label,
            )
            if (ch === '⌫') btn.setAttribute('aria-label', 'Apagar')
            if (ch === '↵') btn.setAttribute('aria-label', 'Enviar palpite')
            btn.addEventListener('click', (ev) => {
                press(ch)
                // clique de mouse ou toque não deve deixar o foco na tecla (o Enter físico seguinte enviaria o palpite, não repetiria a letra)
                if (ev.detail > 0) btn.blur()
            })
            if (/[A-Z]/.test(ch)) keys.set(ch, btn)
            rowEl.appendChild(btn)
        }
        keyboard.appendChild(rowEl)
    }

    const reveal = el(doc, 'div', { class: 'dg-reveal', hidden: true })
    const nextBtn = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary', hidden: true })
    nextBtn.addEventListener('click', () => env.next())
    const root = el(doc, 'div', { class: 'dg-word' }, grid, reveal, keyboard, nextBtn)

    function paintTile(tile: HTMLElement, letter: string, state: string, position: number, selected: boolean): void {
        tile.textContent = letter
        tile.dataset.state = state
        tile.toggleAttribute('data-cursor', selected)
        const label = letter
            ? `Letra ${position}, ${letter}, ${state in STATE_LABEL ? STATE_LABEL[state as LetterState] : 'ainda não enviada'}`
            : `Letra ${position}, vazia`
        tile.setAttribute('aria-label', selected ? `${label}, selecionada` : label)
    }

    /** `word` é a palavra enviada ou as casas da tentativa atual; só a linha atual (sem `letters`) mostra a casa selecionada. */
    function paintRow(index: number, word: string | readonly string[], letters?: LetterState[], animate = false): void {
        const row = rows[index]
        const w = env.progress().word
        const active = !letters && !w.finished && index === w.guesses.length
        row.classList.toggle('dg-flip', animate && !env.reduced())
        row.toggleAttribute('data-active', active)
        const tiles = Array.from(row.children) as HTMLElement[]
        tiles.forEach((tile, i) => {
            tile.style.setProperty('--i', String(i))
            paintTile(tile, word[i] ?? '', letters ? letters[i] : word[i] ? 'typing' : 'empty', i + 1, active && i === cursor)
        })
    }

    function paintKeyboard(): void {
        const best = new Map<string, LetterState>()
        for (const g of env.progress().word.guesses) {
            g.letters.forEach((state, i) => {
                const ch = g.guess[i]
                const prev = best.get(ch)
                if (!prev || RANK[state] > RANK[prev]) best.set(ch, state)
            })
        }
        for (const [ch, btn] of keys) {
            const state = best.get(ch)
            if (state) {
                btn.dataset.state = state
                btn.setAttribute('aria-label', `${ch}, ${STATE_LABEL[state]}`)
            } else {
                delete btn.dataset.state
                btn.setAttribute('aria-label', ch)
            }
        }
    }

    function paintReveal(): void {
        const w = env.progress().word
        reveal.replaceChildren()
        reveal.hidden = !w.finished
        nextBtn.hidden = !w.finished
        nextBtn.textContent = env.nextLabel()
        if (!w.finished) return
        const answer = w.reveal?.answer
        reveal.appendChild(
            el(
                doc,
                'p',
                { class: 'dg-reveal-title' },
                w.solved
                    ? `Acertou em ${w.guesses.length}.`
                    : answer
                      ? `Não foi dessa vez. A palavra era ${answer}.`
                      : 'Não foi dessa vez.',
            ),
        )
        if (w.solved && answer) reveal.appendChild(el(doc, 'p', { class: 'dg-reveal-word' }, answer))
        if (w.reveal?.definition) reveal.appendChild(el(doc, 'p', { class: 'dg-reveal-def' }, w.reveal.definition))
        const lm = w.reveal?.learnMore
        const href = lm ? env.learnMoreHref(lm) : null
        if (lm && href) reveal.appendChild(el(doc, 'a', { class: 'dg-link', href }, LEARN_MORE_LABEL[lm.kind]))
    }

    function draw(): void {
        const w = env.progress().word
        rows.forEach((_, i) => {
            const g = w.guesses[i]
            if (g) paintRow(i, g.guess, g.letters)
            else paintRow(i, i === w.guesses.length && !w.finished ? slots : '')
        })
        paintKeyboard()
        paintReveal()
    }

    function shake(index: number): void {
        const row = rows[index]
        row.classList.remove('dg-shake')
        void row.offsetWidth
        row.classList.add('dg-shake')
    }

    async function submit(): Promise<void> {
        const progress = env.progress()
        const w = progress.word
        if (busy || w.finished) return
        const rowIndex = w.guesses.length
        if (slots.some((ch) => !ch)) {
            shake(rowIndex)
            env.say(`Faltam letras. A palavra tem ${length} letras.`)
            return
        }
        busy = true
        const guess = slots.join('')
        let res
        try {
            res = await env.api.guess(game.number, guess, env.mode === 'publico' ? rowIndex + 1 : undefined)
        } catch (e) {
            busy = false
            if (e instanceof DailyApiError && e.code === 'word_not_accepted') {
                shake(rowIndex)
                env.say('Essa palavra não está na lista. Tente outra.')
            } else if (e instanceof DailyApiError && e.code === 'invalid_guess') {
                shake(rowIndex)
                env.say(describeInvalidGuess(isReason(e.body)))
            } else env.say(env.fail(e))
            return
        }
        clearSlots()
        const next = applyGuess(progress, guess, res)
        const settle = env.reduced() ? 0 : (length - 1) * FLIP_STEP_MS + FLIP_MS
        paintRow(rowIndex, guess, res.letters, true)
        rows.forEach((_, i) => i !== rowIndex && rows[i].classList.remove('dg-flip'))
        env.commit(next, res.completion, settle)
        const spoken = guess
            .split('')
            .map((ch, i) => `${ch} ${STATE_LABEL[res.letters[i]]}`)
            .join(', ')
        env.later(() => {
            busy = false
            draw()
            if (res.solved) env.say(`Acertou em ${next.word.guesses.length}.`)
            else if (res.finished) env.say(`Fim das tentativas. A palavra era ${res.reveal?.answer ?? ''}.`)
            else env.say(`Tentativa ${next.word.guesses.length}: ${spoken}.`)
        }, settle)
    }

    function press(key: string): boolean {
        const w = env.progress().word
        if (busy || w.finished) return false
        if (key === '↵') {
            void submit()
            return true
        }
        if (key === '⌫') {
            // apaga a casa selecionada; se ela já está vazia, volta uma e apaga essa
            if (!slots[cursor] && cursor > 0) cursor--
            slots[cursor] = ''
        } else if (key === '←') {
            cursor = Math.max(0, cursor - 1)
        } else if (key === '→') {
            cursor = Math.min(length - 1, cursor + 1)
        } else {
            slots[cursor] = key
            cursor = nextCursor(cursor)
        }
        paintRow(w.guesses.length, slots)
        return true
    }

    /** Depois de escrever na casa `from`: a próxima vazia à direita, senão a primeira vazia, senão a casa seguinte. */
    function nextCursor(from: number): number {
        for (let i = from + 1; i < length; i++) if (!slots[i]) return i
        const empty = slots.indexOf('')
        return empty >= 0 ? empty : Math.min(length - 1, from + 1)
    }

    function clearSlots(): void {
        slots = Array(length).fill('')
        cursor = 0
    }

    draw()
    return {
        el: root,
        refresh: () => {
            clearSlots()
            busy = false
            draw()
        },
        onKey(e) {
            if (e.ctrlKey || e.metaKey || e.altKey) return false
            if (e.key === 'Enter') {
                if ((e.target as HTMLElement | null)?.closest?.('button, a')) return false
                return press('↵')
            }
            if (e.key === 'Backspace') return press('⌫')
            if (e.key === 'ArrowLeft') return press('←')
            if (e.key === 'ArrowRight') return press('→')
            if (e.key.length === 1) {
                const letter = normalizeLetters(e.key)
                if (letter.length === 1) return press(letter)
            }
            return false
        },
    }
}

function isReason(body: unknown): unknown {
    return typeof body === 'object' && body !== null && 'reason' in body ? (body as { reason: unknown }).reason : null
}
