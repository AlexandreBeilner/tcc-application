import { Link } from 'react-router-dom'
import type { LeagueSummary } from '../../../services/leagues'
import styles from './index.module.css'

const WINDOW_LABEL = { week: 'Semanal', month: 'Mensal' } as const

// Item da lista de ligas: nome, período, quantas pessoas e quem criou.
export function LeagueCard({ league }: { league: LeagueSummary }) {
    return (
        <Link to={`/ligas/${league.id}`} className={styles.card}>
            <span className={styles.name}>{league.name}</span>
            <span className={styles.meta}>
                {WINDOW_LABEL[league.window]} · {league.memberCount} {league.memberCount === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                {league.isOwner ? 'Criada por você' : `de @${league.ownerUsername}`}
            </span>
        </Link>
    )
}
