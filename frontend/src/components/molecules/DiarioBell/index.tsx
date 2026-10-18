import { Gamepad2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDailyToday } from '../../../features/diario/useDailyToday'
import styles from './index.module.css'

// Entrada do Diário na `TopBar` (DI.4.2), ao lado do sino de notícias. Sempre visível com o Diário no ar,
// mesmo para quem ainda não destravou o Portfólio (o jogo não depende da trilha). O ponto dourado
// "apaga" quando a conta já fechou o jogo de hoje. Desligado ou agendado: não aparece.
export function DiarioBell() {
    const today = useDailyToday().data

    if (!today || today.status !== 'live') return null
    const pending = !today.completed

    return (
        <Link to="/diario" className={styles.bell} aria-label={pending ? 'Diário Selucra, jogo de hoje pendente' : 'Diário Selucra'}>
            <Gamepad2 size={20} strokeWidth={1.6} aria-hidden="true" />
            {pending && <span className={styles.dot} aria-hidden="true" />}
        </Link>
    )
}
