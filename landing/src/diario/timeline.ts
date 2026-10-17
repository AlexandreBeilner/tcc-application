import type { CardEnv, CardView } from './cards.ts'
import { LEARN_MORE_LABEL } from './cards.ts'
import { append, el } from './dom.ts'
import { applyTimeline } from './progress.ts'

/** Move um item de `from` para `to` (índices já dentro dos limites); devolve uma lista nova. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const copy = [...list]
    if (from === to || from < 0 || to < 0 || from >= copy.length || to >= copy.length) return copy
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
}

/** Posição de destino do arraste: quantos itens (fora o arrastado) têm o centro acima do ponteiro. */
export function dropIndex(centers: readonly number[], pointerY: number): number {
    return centers.filter((c) => c < pointerY).length
}

export function createTimelineCard(env: CardEnv): CardView {
    const { doc, game } = env
    const labels = new Map(game.cards.timeline.events.map((e) => [e.id, e.label]))
    let order = game.cards.timeline.events.map((e) => e.id)
    let busy = false

    const list = el(doc, 'ol', { class: 'dg-tl' })
    const hint = el(
        doc,
        'p',
        { class: 'dg-hint' },
        'Do mais antigo (em cima) ao mais recente (embaixo). Arraste pela alça ou use os botões.',
    )
    const confirm = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary' }, 'Conferir ordem')
    const after = el(doc, 'div', { class: 'dg-after', hidden: true })
    const nextBtn = el(doc, 'button', { type: 'button', class: 'dg-btn dg-btn-primary', hidden: true })
    nextBtn.addEventListener('click', () => env.next())

    const findItem = (id: string) => (Array.from(list.children) as HTMLElement[]).find((c) => c.dataset.id === id) ?? null

    function move(id: string, to: number, focus?: 'up' | 'down' | 'grip'): void {
        const from = order.indexOf(id)
        if (busy || env.progress().timeline.answered || to < 0 || to >= order.length || from === to) return
        order = moveItem(order, from, to)
        draw()
        env.say(`${labels.get(id)}: posição ${to + 1} de ${order.length}.`)
        const li = findItem(id)
        const target =
            li?.querySelector<HTMLButtonElement>(`.dg-tl-${focus ?? 'grip'}:not(:disabled)`) ??
            li?.querySelector<HTMLButtonElement>('.dg-tl-grip')
        target?.focus()
    }

    function startDrag(li: HTMLElement, id: string, ev: PointerEvent): void {
        if (busy || env.progress().timeline.answered) return
        const grip = ev.currentTarget as HTMLElement
        grip.setPointerCapture?.(ev.pointerId)
        li.classList.add('dg-dragging')
        const onMove = (e: PointerEvent) => {
            const others = Array.from(list.children).filter((c) => c !== li) as HTMLElement[]
            const centers = others.map((c) => {
                const r = c.getBoundingClientRect()
                return r.top + r.height / 2
            })
            const index = dropIndex(centers, e.clientY)
            const ref = others[index] ?? null
            if (li.nextElementSibling !== ref) list.insertBefore(li, ref)
        }
        const onEnd = () => {
            doc.removeEventListener('pointermove', onMove)
            doc.removeEventListener('pointerup', onEnd)
            doc.removeEventListener('pointercancel', onEnd)
            li.classList.remove('dg-dragging')
            const next = Array.from(list.children).map((c) => (c as HTMLElement).dataset.id!)
            const changed = next.some((v, i) => v !== order[i])
            order = next
            draw()
            if (changed) env.say(`${labels.get(id)}: posição ${order.indexOf(id) + 1} de ${order.length}.`)
            findItem(id)?.querySelector<HTMLButtonElement>('.dg-tl-grip')?.focus()
        }
        // no documento (não na alça): o fim do arraste chega mesmo se a captura do ponteiro falhar
        doc.addEventListener('pointermove', onMove)
        doc.addEventListener('pointerup', onEnd)
        doc.addEventListener('pointercancel', onEnd)
    }

    function draw(): void {
        const t = env.progress().timeline
        const shown = t.answered ? t.order : order
        list.replaceChildren()
        shown.forEach((id, i) => {
            const label = labels.get(id) ?? id
            const hit = t.answered ? t.positionHits[i] : undefined
            const li = el(doc, 'li', { class: 'dg-tl-item', 'data-id': id, 'data-hit': hit === undefined ? undefined : String(hit) })
            const year = t.answered ? t.events.find((e) => e.id === id)?.year : undefined
            const mark = hit === undefined ? '' : hit ? '✓' : '✗'
            if (t.answered) {
                append(li, [
                    el(doc, 'span', { class: 'dg-tl-pos', 'aria-hidden': 'true' }, String(i + 1)),
                    el(doc, 'span', { class: 'dg-tl-label' }, label),
                    year !== undefined ? el(doc, 'span', { class: 'dg-tl-year' }, String(year)) : null,
                    el(doc, 'span', { class: 'dg-tl-mark', 'aria-hidden': 'true' }, mark),
                    el(doc, 'span', { class: 'dg-sr' }, hit ? 'posição certa' : 'posição errada'),
                ])
            } else {
                const grip = el(
                    doc,
                    'button',
                    { type: 'button', class: 'dg-tl-grip', 'aria-label': `Arrastar ${label}. Setas para cima e para baixo também movem.` },
                    '⠿',
                )
                const up = el(
                    doc,
                    'button',
                    { type: 'button', class: 'dg-tl-up dg-icon-btn', 'aria-label': `Subir ${label}`, disabled: i === 0 },
                    '↑',
                )
                const down = el(
                    doc,
                    'button',
                    { type: 'button', class: 'dg-tl-down dg-icon-btn', 'aria-label': `Descer ${label}`, disabled: i === shown.length - 1 },
                    '↓',
                )
                up.addEventListener('click', () => move(id, i - 1, i - 1 === 0 ? 'down' : 'up'))
                down.addEventListener('click', () => move(id, i + 1, i + 1 === shown.length - 1 ? 'up' : 'down'))
                grip.addEventListener('pointerdown', (ev) => startDrag(li, id, ev))
                grip.addEventListener('keydown', (ev) => {
                    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
                        ev.preventDefault()
                        move(id, i + (ev.key === 'ArrowUp' ? -1 : 1), 'grip')
                    }
                })
                li.append(
                    grip,
                    el(doc, 'span', { class: 'dg-tl-pos', 'aria-hidden': 'true' }, String(i + 1)),
                    el(doc, 'span', { class: 'dg-tl-label' }, label),
                    up,
                    down,
                )
            }
            list.appendChild(li)
        })
        hint.hidden = t.answered
        confirm.hidden = t.answered
        confirm.disabled = busy
        after.hidden = !t.answered
        after.replaceChildren()
        nextBtn.hidden = !t.answered
        nextBtn.textContent = env.nextLabel()
        if (!t.answered) return
        after.appendChild(
            el(doc, 'p', { class: 'dg-reveal-title' }, t.correct ? 'Ordem certa.' : 'Não foi dessa vez. Esta é a ordem certa:'),
        )
        const truth = el(doc, 'ol', { class: 'dg-truth' })
        for (const e of t.events) {
            const href = e.learnMore ? env.learnMoreHref(e.learnMore) : null
            truth.appendChild(
                el(
                    doc,
                    'li',
                    {},
                    el(doc, 'strong', {}, `${e.year}: ${e.label}`),
                    e.explanation ? el(doc, 'span', { class: 'dg-explain' }, ` ${e.explanation}`) : null,
                    e.sourceRef ? el(doc, 'span', { class: 'dg-source' }, ` Fonte: ${e.sourceRef}`) : null,
                    e.learnMore && href ? el(doc, 'a', { class: 'dg-link', href }, ` ${LEARN_MORE_LABEL[e.learnMore.kind]}`) : null,
                ),
            )
        }
        after.appendChild(truth)
    }

    confirm.addEventListener('click', async () => {
        if (busy || env.progress().timeline.answered) return
        busy = true
        confirm.disabled = true
        const sent = [...order]
        try {
            const res = await env.api.timeline(game.number, sent)
            busy = false
            env.commit(applyTimeline(env.progress(), sent, res), res.completion, 0)
            draw()
            env.say(res.correct ? 'Ordem certa.' : 'Ordem errada.')
        } catch (e) {
            busy = false
            confirm.disabled = false
            env.say(env.fail(e))
        }
    })

    draw()
    return {
        el: el(
            doc,
            'div',
            { class: 'dg-timeline' },
            el(doc, 'p', { class: 'dg-question' }, 'Ordene os eventos do mais antigo ao mais recente.'),
            hint,
            list,
            confirm,
            after,
            nextBtn,
        ),
        refresh: draw,
    }
}
