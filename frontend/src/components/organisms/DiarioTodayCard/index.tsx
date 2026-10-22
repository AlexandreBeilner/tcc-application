import { useNavigate } from 'react-router-dom'
import { useDailyToday } from '../../../features/diario/useDailyToday'
import { Card } from '../../atoms/Card'
import styles from './index.module.css'

// Chamada "Diário de hoje" no Portfólio (DI.4.2). Só aparece com o Diário no ar e o jogo de hoje ainda
// por fazer: quando a conta já fechou os dois cartões, ou o Diário está desligado ou agendado, não
// ocupa lugar nenhum (nada de cartão "apagado" que pareça pendência).
export function DiarioTodayCard() {
    const navigate = useNavigate()
    const today = useDailyToday().data

    if (!today || today.status !== 'live' || today.completed) return null

    return (
        <Card accent className={styles.card} onClick={() => navigate('/diario')}>
            <span className={styles.eyebrow}>Diário de hoje</span>
            <span className={styles.title}>Dois desafios novos</span>
            <span className={styles.sub}>Jogue para ganhar XP e manter sua sequência.</span>
        </Card>
    )
}
