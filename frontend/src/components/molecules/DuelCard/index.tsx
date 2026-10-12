import { Link } from 'react-router-dom'
import type { Duel } from '../../../services/duels'
import { Avatar } from '../../atoms/Avatar'
import { CosmeticTags } from '../CosmeticTags'
import styles from './index.module.css'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

function statusLine(duel: Duel): string {
    switch (duel.status) {
        case 'pending':
            return duel.role === 'challenger' ? 'Aguardando resposta' : 'Convite para você'
        case 'active':
            return `Em andamento até ${dateFormatter.format(new Date(duel.endsAt as string))}`
        case 'finished':
            if (duel.result === 'won') return 'Você venceu'
            if (duel.result === 'lost') return 'Você não venceu desta vez'
            return 'Empate'
        case 'declined':
            return 'Recusado'
        case 'cancelled':
            return 'Cancelado'
        case 'expired':
            return 'Sem resposta, encerrado'
    }
}

// Item da lista de duelos: quem é o adversário (com moldura, selo e título) e em que pé está.
export function DuelCard({ duel }: { duel: Duel }) {
    return (
        <Link to={`/duelos/${duel.id}`} className={styles.card}>
            <Avatar username={duel.opponent.username} avatarUrl={duel.opponent.avatarUrl} frame={duel.opponent.cosmetics.frame} />
            <span className={styles.body}>
                <span className={styles.name}>{duel.opponent.name}</span>
                <CosmeticTags cosmetics={duel.opponent.cosmetics} />
                <span className={styles.status}>{statusLine(duel)}</span>
            </span>
        </Link>
    )
}
