import { useEffect } from 'react'
import { resolveShortcut, swipeAction } from '../lessonShortcuts'
import type { ShortcutAction } from '../lessonShortcuts'

const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
const INTERACTIVE_SELECTOR = 'button, a[href], summary, [role="button"]'
// Dentro de widget (arrastar, controle deslizante, tabela com setas) o gesto e a tecla são do widget.
const WIDGET_SELECTOR = '[data-lesson-widget]'
// Janela aberta por cima da lição (recompensa, confirmação): os atalhos esperam ela fechar.
const OVERLAY_SELECTOR = 'dialog[open], [aria-modal="true"]'

function click(selector: string) {
    const button = document.querySelector<HTMLButtonElement>(selector)
    if (button && !button.disabled) button.click()
    return button !== null && !button.disabled
}

function run(action: ShortcutAction) {
    switch (action.type) {
        case 'back':
            click('[data-lesson-back]')
            return
        case 'continue':
            click('[data-lesson-continue]')
            return
        case 'enter':
            // Com uma alternativa marcada, o Enter responde; senão, avança. O `disabled` dos botões já
            // impede pular pergunta ou missão.
            if (!click('[data-lesson-submit]')) click('[data-lesson-continue]')
            return
        case 'option': {
            const options = document.querySelectorAll<HTMLButtonElement>('[data-lesson-option]')
            const option = options[action.index]
            if (option && !option.disabled) option.click()
            return
        }
    }
}

// O alvo pode ser `window`/`document` (evento disparado fora de um elemento): aí não há elemento a consultar.
function asElement(target: EventTarget | null): HTMLElement | null {
    return target instanceof HTMLElement ? target : null
}

function isEditable(target: HTMLElement | null) {
    return target !== null && (target.isContentEditable || EDITABLE_TAGS.includes(target.tagName))
}

// Alguma coisa entre o toque e a raiz rola na horizontal (tabela larga, trilho de cartões)? Então o gesto
// é dela.
function insideHorizontalScroller(target: HTMLElement | null) {
    for (let node = target; node && node !== document.body; node = node.parentElement) {
        if (node.scrollWidth > node.clientWidth && ['auto', 'scroll'].includes(getComputedStyle(node).overflowX)) return true
    }
    return false
}

function swipeBlocked(target: HTMLElement | null) {
    return isEditable(target) || target?.closest(WIDGET_SELECTOR) != null || insideHorizontalScroller(target)
}

// Atalhos de teclado e gestos do player (LJ.5.3): setas, Enter e 1 a 4 no desktop, deslizar no celular. Tudo
// clica nos botões reais (`data-lesson-*`), então herda o `disabled` de cada trava: nunca pula checkpoint
// ou missão. Os gestos só existem em tela de toque (os eventos `touch*` não disparam com mouse).
export function useLessonShortcuts(): void {
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const target = asElement(event.target)
            if (document.querySelector(OVERLAY_SELECTOR)) return
            const action = resolveShortcut({
                key: event.key,
                hasModifier: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
                editable: isEditable(target),
                inWidget: target?.closest(WIDGET_SELECTOR) != null,
                interactive: target?.closest(INTERACTIVE_SELECTOR) != null,
            })
            if (action) run(action)
        }

        let start: { x: number; y: number; at: number } | null = null

        function handleTouchStart(event: TouchEvent) {
            const touch = event.touches[0]
            // Dois dedos é pinça (zoom): nunca é gesto de navegação.
            start =
                event.touches.length === 1 && !swipeBlocked(asElement(event.target))
                    ? { x: touch.clientX, y: touch.clientY, at: Date.now() }
                    : null
        }

        function handleTouchEnd(event: TouchEvent) {
            const touch = event.changedTouches[0]
            const origin = start
            start = null
            if (!origin || !touch || document.querySelector(OVERLAY_SELECTOR)) return
            const action = swipeAction({ dx: touch.clientX - origin.x, dy: touch.clientY - origin.y, durationMs: Date.now() - origin.at })
            if (action) run({ type: action })
        }

        function handleTouchCancel() {
            start = null
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('touchstart', handleTouchStart, { passive: true })
        window.addEventListener('touchend', handleTouchEnd, { passive: true })
        window.addEventListener('touchcancel', handleTouchCancel, { passive: true })
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('touchstart', handleTouchStart)
            window.removeEventListener('touchend', handleTouchEnd)
            window.removeEventListener('touchcancel', handleTouchCancel)
        }
    }, [])
}
