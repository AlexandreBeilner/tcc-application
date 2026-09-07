import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { RewardRevealProps } from './types'
import styles from './index.module.css'

export type { RewardRevealProps } from './types'

const AUTO_DISMISS_MS = 4000

// "Teatro de recompensa" (identidade-visual-padroes.md §6) — invólucro
// genérico (dourado, glow, animação de entrada), reutilizado sem alteração
// por XP, level-up, conquista e streak (tarefas I.3-I.5, ainda não
// conectadas): só ícone/título/descrição mudam por chamada. Fila de
// exibição (um por vez) fica em `features/shell/RewardRevealProvider`, não
// aqui — este componente só sabe mostrar um reveal e se fechar sozinho.
export function RewardReveal({ icon, title, description, onDismiss }: RewardRevealProps) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
        return () => clearTimeout(timer)
    }, [onDismiss])

    return (
        <div className={styles.wrapper}>
            <div className={styles.panel} role="status">
                <span className={styles.badge} aria-hidden="true">
                    {icon}
                </span>
                <div className={styles.text}>
                    <p className={styles.title}>{title}</p>
                    {description && <p className={styles.description}>{description}</p>}
                </div>
                <button type="button" className={styles.close} onClick={onDismiss} aria-label="Fechar aviso">
                    <X size={16} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    )
}
