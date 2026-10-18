import { Flame } from 'lucide-react'
import type { StreakSealProps } from './types'
import styles from './index.module.css'

export type { StreakSealProps } from './types'

// Selo da sequência de acertos de primeira (LJ.1.6), com o mesmo ícone de chama do streak diário. Aos 5 a chama
// ganha brilho. `aria-live="polite"` anuncia sem interromper a leitura da explicação.
export function StreakSeal({ milestone }: StreakSealProps) {
    return (
        <p className={`${styles.seal} ${milestone === 5 ? styles.big : ''}`} aria-live="polite">
            <Flame className={styles.flame} size={milestone === 5 ? 20 : 16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            {milestone} de primeira seguidas!
        </p>
    )
}
