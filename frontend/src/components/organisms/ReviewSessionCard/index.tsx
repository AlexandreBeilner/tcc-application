import { useNavigate } from 'react-router-dom'
import { Card } from '../../atoms/Card'
import type { ReviewSessionCardProps } from './types'
import styles from './index.module.css'

export type { ReviewSessionCardProps } from './types'

// Convite à revisão de 1 minuto (LJ.5.6), no hub das trilhas. É convite, não cobrança: sem contador de
// pendências, sem "atrasada", sem prazo. O hub só o monta quando há perguntas vencidas suficientes.
export function ReviewSessionCard({ questionCount }: ReviewSessionCardProps) {
    const navigate = useNavigate()

    return (
        <Card accent className={styles.cardLayout} onClick={() => navigate('/trilha/revisao')}>
            <span className={styles.eyebrow}>Revisão de 1 minuto</span>
            <span className={styles.title}>{questionCount} perguntas para fixar o que você já viu</span>
            <span className={styles.hint}>Sem nota e sem pressa</span>
        </Card>
    )
}
