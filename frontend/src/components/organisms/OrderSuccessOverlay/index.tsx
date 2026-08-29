import { Check } from 'lucide-react'
import { Button } from '../../atoms/Button'
import type { OrderSuccessOverlayProps } from './types'
import styles from './index.module.css'

export type { OrderSuccessOverlayProps } from './types'

// "Teatro de recompensa" da tela 4.7 (mockup vivo, identidade-visual-
// padroes.md §0/§6) — energia dourada reservada pro momento de sucesso em
// si, nunca durante a decisão (painel de compra/confirmação ficam neutros).
// Sem selo de "+XP": `POST /market/orders`/`fixed-income/purchases` não
// devolve nenhum sinal de gamificação em tempo real (decisão da tarefa
// 6.0.3 — o desbloqueio é lazy via replay), então mostrar um número aqui
// seria inventar um dado que a resposta não tem.
export function OrderSuccessOverlay({ message, continueLabel, onContinue }: OrderSuccessOverlayProps) {
    return (
        <div className={styles.overlay} role="status">
            <span className={styles.badge} aria-hidden="true">
                <Check size={30} strokeWidth={3} />
            </span>
            <h2 className={styles.title}>Ordem executada</h2>
            <p className={styles.message}>{message}</p>
            <Button onClick={onContinue}>{continueLabel}</Button>
        </div>
    )
}
