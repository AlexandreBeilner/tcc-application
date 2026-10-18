import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { GlossaryTermProps } from './types'
import styles from './index.module.css'

export type { GlossaryTermProps } from './types'

// Popover próprio (tarefa C.1), não `title` nativo do navegador — precisa
// funcionar em toque, não só hover, mesmo motivo do `Select`
// (`components/atoms/Select`) não usar o `<select>` nativo. Clique/toque e
// hover só abrem (nunca alternam) pra evitar o clique fechar de novo um
// popover que o próprio hover já tinha aberto num mouse de desktop; fecha
// via mouse saindo, blur, clique fora ou Escape.
export function GlossaryTerm({ term, definition }: GlossaryTermProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLSpanElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLSpanElement>(null)
    const popoverId = useId()

    // O popover nasce centralizado no termo; perto da borda da tela ele
    // vazaria. Mede depois de montar e desloca na horizontal (e vira pra cima
    // se faltar espaço embaixo) pra ficar sempre dentro da viewport.
    useLayoutEffect(() => {
        const popover = popoverRef.current
        if (!open || !popover) return

        const margin = 8
        popover.style.transform = 'translateX(-50%)'
        popover.style.top = ''
        popover.style.bottom = ''

        const rect = popover.getBoundingClientRect()
        const viewportWidth = document.documentElement.clientWidth
        let shift = 0
        if (rect.left < margin) shift = margin - rect.left
        else if (rect.right > viewportWidth - margin) shift = viewportWidth - margin - rect.right
        if (shift !== 0) popover.style.transform = `translateX(calc(-50% + ${shift}px))`

        const triggerRect = triggerRef.current?.getBoundingClientRect()
        if (triggerRect && rect.bottom > window.innerHeight - margin && triggerRect.top - rect.height - margin > 0) {
            popover.style.top = 'auto'
            popover.style.bottom = 'calc(100% + var(--space-2))'
        }
    }, [open])

    useEffect(() => {
        if (!open) return

        function handlePointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
        } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
            triggerRef.current?.focus()
        }
    }

    return (
        <span className={styles.wrapper} ref={rootRef}>
            <button
                type="button"
                ref={triggerRef}
                className={styles.term}
                aria-describedby={open ? popoverId : undefined}
                onClick={() => setOpen(true)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onBlur={() => setOpen(false)}
                onKeyDown={handleKeyDown}
            >
                {term}
            </button>

            {open && (
                <span role="tooltip" id={popoverId} ref={popoverRef} className={styles.popover}>
                    {definition}
                </span>
            )}
        </span>
    )
}
