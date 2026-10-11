import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import { CosmeticTags } from '../../molecules/CosmeticTags'
import type { LeagueStandingsProps } from './types'
import { Delta } from '../../atoms/Delta'
import styles from './index.module.css'

export type { LeagueStandingsProps } from './types'

// Classificação de uma liga (MO.5.2c): posição, quem é, selo/título e a rentabilidade percentual do
// período. Nunca mostra patrimônio absoluto (RNF09). O dono ganha o botão de tirar um membro.
export function LeagueStandings({ standings, onRemove, removingId }: LeagueStandingsProps) {
    if (standings.length === 0) {
        return <p className={styles.empty}>Ninguém na classificação ainda.</p>
    }
    return (
        <ol className={styles.list}>
            {standings.map((row) => (
                <li key={row.userId} className={[styles.row, row.isYou && styles.you].filter(Boolean).join(' ')}>
                    <span className={styles.position}>{row.position}º</span>
                    <Avatar username={row.username} avatarUrl={row.avatarUrl} frame={row.cosmetics.frame} />
                    <span className={styles.who}>
                        <span className={styles.name}>
                            {row.name}
                            {row.isYou && <span className={styles.youTag}> (você)</span>}
                        </span>
                        <span className={styles.meta}>
                            @{row.username} · Nível {row.level}
                        </span>
                        <CosmeticTags cosmetics={row.cosmetics} />
                    </span>
                    {row.profitabilityPct === null ? (
                        <span className={`${styles.pct} ${styles.neutral}`} title="Não foi possível calcular agora">
                            Sem dado
                        </span>
                    ) : (
                        <span className={`${styles.pct} tabular-nums`}>
                            <Delta percent={row.profitabilityPct} variant="text" />
                        </span>
                    )}
                    {onRemove && !row.isYou && (
                        <Button variant="secondary" disabled={removingId === row.userId} onClick={() => onRemove(row.userId)}>
                            Tirar
                        </Button>
                    )}
                </li>
            ))}
        </ol>
    )
}
