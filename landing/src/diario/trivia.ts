import type { CardEnv, CardView } from './cards.ts'
import { LEARN_MORE_LABEL } from './cards.ts'
import { el } from './dom.ts'
import { applyTrivia } from './progress.ts'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function createTriviaCard(env: CardEnv): CardView {
    const { doc, game } = env
    const { question, options } = game.cards.trivia
    let selected: number | null = null
    let busy = false

    const buttons = options.map((text, i) => {
        const btn = el(doc, 'button', { type: 'button', class: 'dg-option', role: 'radio', 'aria-checked': 'false', 'data-index': i })
        btn.append(
            el(doc, 'span', { class: 'dg-option-letter', 'aria-hidden': 'true' }, LETTERS[i]),
            el(doc, 'span', { class: 'dg-option-text' }, text),
            el(doc, 'span', { class: 'dg-option-mark', 'aria-hidden': 'true' }),
        )
        btn.addEventListener('click', () => {
            if (busy || env.progress().trivia.answered) return
            selected = i
            paint()
        })
        return btn
    })
    const list = el(doc, 'div', { class: 'dg-options', role: 'radiogroup' }, ...buttons)
    const title = el(doc, 'p', { class: 'dg-question', id: `dg-q-${game.number}` }, question)
    list.setAttribute('aria-labelledby', title.id)
    const confirm = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary' }, 'Confirmar resposta')
    const after = el(doc, 'div', { class: 'dg-after', hidden: true })
    const nextBtn = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary', hidden: true })
    nextBtn.addEventListener('click', () => env.next())

    confirm.addEventListener('click', async () => {
        if (busy || selected === null || env.progress().trivia.answered) return
        busy = true
        paint()
        const choice = selected
        try {
            const res = await env.api.trivia(game.number, choice)
            env.commit(applyTrivia(env.progress(), choice, res), res.completion, 0)
            busy = false
            paint()
            env.say(res.correct ? 'Resposta certa.' : 'Resposta errada.')
        } catch (e) {
            busy = false
            paint()
            env.say(env.fail(e))
        }
    })

    function paint(): void {
        const t = env.progress().trivia
        buttons.forEach((btn, i) => {
            const isChoice = t.answered ? t.choice === i : selected === i
            btn.setAttribute('aria-checked', String(isChoice))
            btn.disabled = t.answered || busy
            let state = isChoice ? 'selected' : 'idle'
            let mark = ''
            let spoken = ''
            if (t.answered) {
                if (i === t.correctIndex) {
                    state = 'right'
                    mark = '✓'
                    spoken = isChoice ? ', sua resposta, certa' : ', a resposta certa'
                } else if (isChoice) {
                    state = 'wrong'
                    mark = '✗'
                    spoken = ', sua resposta, errada'
                }
            }
            btn.dataset.state = state
            btn.querySelector('.dg-option-mark')!.textContent = mark
            btn.setAttribute('aria-label', `${LETTERS[i]}. ${options[i]}${spoken}`)
        })
        confirm.hidden = t.answered
        confirm.disabled = selected === null || busy
        after.hidden = !t.answered
        after.replaceChildren()
        nextBtn.hidden = !t.answered
        nextBtn.textContent = env.nextLabel()
        if (!t.answered) return
        after.appendChild(el(doc, 'p', { class: 'dg-reveal-title' }, t.correct ? 'Resposta certa.' : 'Resposta errada.'))
        if (t.explanation) after.appendChild(el(doc, 'p', { class: 'dg-explain' }, t.explanation))
        if (t.sourceRef) after.appendChild(el(doc, 'p', { class: 'dg-source' }, `Fonte: ${t.sourceRef}`))
        const href = t.learnMore ? env.learnMoreHref(t.learnMore) : null
        if (t.learnMore && href) after.appendChild(el(doc, 'a', { class: 'dg-link', href }, LEARN_MORE_LABEL[t.learnMore.kind]))
    }

    paint()
    return { el: el(doc, 'div', { class: 'dg-trivia' }, title, list, confirm, after, nextBtn), refresh: paint }
}
