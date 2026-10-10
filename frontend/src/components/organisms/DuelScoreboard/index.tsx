import { formatSignedPercent } from '../../../features/market/format'
import type { Duel, DuelPlayerScore } from '../../../services/duels'
import { Avatar } from '../../atoms/Avatar'
import { CosmeticTags } from '../../molecules/CosmeticTags'
import type { DuelScoreboardProps } from './types'
import styles from './index.module.css'

export type { DuelScoreboardProps } from './types'

function pctClass(pct: number): string {
    if (pct > 0) return styles.gain
    if (pct < 0) return styles.loss
    return styles.neutral
}

function Side({
    label,
    username,
    avatarUrl,
    frame,
    cosmetics,
    score,
    winner,
}: {
    label: string
    username: string
    avatarUrl: string | null
    frame: string | null
    cosmetics: Duel['opponent']['cosmetics'] | null
    score: DuelPlayerScore | null
    winner: boolean
}) {
    return (
        <div className={[styles.side, winner && styles.winner].filter(Boolean).join(' ')}>
            <Avatar username={username} avatarUrl={avatarUrl} frame={frame} size="sm" />
            <span className={styles.label}>{label}</span>
            {cosmetics && <CosmeticTags cosmetics={cosmetics} />}
            {score ? (
                <>
                    <span className={`${styles.pct} tabular-nums ${pctClass(score.returnPct)}`}>
                        {formatSignedPercent(score.returnPct)}
                    </span>
                    <span className={styles.operated}>{score.operated ? 'Já operou no duelo' : 'Ainda não operou'}</span>
                </>
            ) : (
                <span className={styles.operated}>Sem placar ainda</span>
            )}
        </div>
    )
}

const REASON_TEXT = {
    profitability: 'Venceu quem teve a maior rentabilidade no período.',
    abandonment: 'Quem não operou durante o duelo perde por abandono.',
    tie: 'A rentabilidade foi a mesma, então é empate.',
    both_inactive: 'Nenhum dos dois operou, então ficou empatado.',
} as const

// Placar lado a lado (MO.5.3): a pessoa de um lado, o adversário do outro, só em percentual do
// período (RNF09). Em andamento é o parcial de agora; encerrado, o resultado gravado.
export function DuelScoreboard({ duel, you }: DuelScoreboardProps) {
    const finished = duel.status === 'finished'
    return (
        <section className={styles.board} aria-label="Placar do duelo">
            <div className={styles.sides}>
                <Side
                    label="Você"
                    username={you.username}
                    avatarUrl={you.avatarUrl}
                    frame={you.frame}
                    cosmetics={null}
                    score={duel.you}
                    winner={finished && duel.result === 'won'}
                />
                <span className={styles.versus} aria-hidden="true">
                    x
                </span>
                <Side
                    label={duel.opponent.name}
                    username={duel.opponent.username}
                    avatarUrl={duel.opponent.avatarUrl}
                    frame={duel.opponent.cosmetics.frame}
                    cosmetics={duel.opponent.cosmetics}
                    score={duel.them}
                    winner={finished && duel.result === 'lost'}
                />
            </div>
            {finished && duel.reason && <p className={styles.reason}>{REASON_TEXT[duel.reason]}</p>}
            {duel.status === 'active' && (
                <p className={styles.reason}>
                    Placar parcial de agora. Para valer, é preciso operar pelo menos uma vez até o fim do duelo.
                </p>
            )}
        </section>
    )
}
