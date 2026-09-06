import { Lock } from 'lucide-react'
import styles from './index.module.css'
import type { LockedAssetBadgeProps } from './types'

export type { LockedAssetBadgeProps } from './types'

// Estado visual travado por linha em EquityList/FixedIncomeList (tarefa
// 7.0.1, telas 4.2/4.4) — só o reflexo de UX; a garantia real é o 403 do
// backend (`ProductLockedError`, ver `.docs/backend/market.md`).
export function LockedAssetBadge({ lessonCode }: LockedAssetBadgeProps) {
    const label = lessonCode
        ? `Produto travado — desbloqueia na lição ${lessonCode}`
        : 'Produto travado pela trilha'

    return (
        <span className={styles.badge} title={label} aria-label={label}>
            <Lock size={14} strokeWidth={2} aria-hidden="true" />
        </span>
    )
}
