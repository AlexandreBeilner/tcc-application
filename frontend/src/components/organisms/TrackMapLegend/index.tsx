import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Info, X } from 'lucide-react'
import type { TrackMapLegendProps } from './types'
import styles from './index.module.css'

export type { TrackMapLegendProps } from './types'

// Legenda do Mapa da Trilha (achado P.1 -> ajuste P.2): antes um
// `.legendCard` sempre visível na sidebar (sticky em desktop, empilhado
// depois do path inteiro em mobile/tablet) — ocupava espaço fixo em toda
// visita à tela, mesmo sendo conteúdo estático que não muda entre trilhas.
// Vira ícone no cabeçalho (não na sidebar, pra não depender de scroll em
// nenhum breakpoint) + overlay sob demanda, mesmo padrão de "confirmação de
// ação importante" (identidade-visual-padroes.md §7 e
// `OrderConfirmationDialog`, auditado antes de abrir este componente): bottom
// sheet subindo de baixo em mobile/tablet, modal central em desktop — nunca
// um 3º padrão de overlay.
export function TrackMapLegend({ accentColor }: TrackMapLegendProps) {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        function handleKeydown(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false)
        }
        document.addEventListener('keydown', handleKeydown)
        return () => document.removeEventListener('keydown', handleKeydown)
    }, [isOpen])

    function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) setIsOpen(false)
    }

    return (
        <>
            <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)} aria-label="Como ler o mapa">
                <Info size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>

            {isOpen && (
                <div className={styles.backdrop} onMouseDown={handleBackdropClick}>
                    <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="track-map-legend-title">
                        <div className={styles.panelHeader}>
                            <h2 id="track-map-legend-title" className={styles.title}>
                                Como ler o mapa
                            </h2>
                            <button type="button" className={styles.close} onClick={() => setIsOpen(false)} aria-label="Fechar">
                                <X size={18} strokeWidth={2.4} />
                            </button>
                        </div>

                        <ul className={styles.legend}>
                            <li>
                                <span className={styles.legendLine} style={{ background: accentColor }} aria-hidden="true" />
                                Já concluído (sólido)
                            </li>
                            <li>
                                <span className={styles.legendLineDashed} aria-hidden="true" />
                                Ainda não chegou (tracejado)
                            </li>
                            <li>
                                <span className={styles.legendDot} style={{ background: 'var(--color-brand-500)' }} aria-hidden="true" />
                                Linha "você está aqui"
                            </li>
                            <li>
                                <span className={styles.legendDot} style={{ background: 'var(--color-gamify-500)' }} aria-hidden="true" />
                                Marco que libera um produto real
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </>
    )
}
