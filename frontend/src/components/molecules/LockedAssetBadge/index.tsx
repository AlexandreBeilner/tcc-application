import { Locked } from '../../atoms/Locked'
import styles from './index.module.css'
import type { LockedAssetBadgeProps } from './types'

export type { LockedAssetBadgeProps } from './types'

// Estado visual travado por linha em EquityList/FixedIncomeList (tarefa
// 7.0.1, telas 4.2/4.4) — só o reflexo de UX; a garantia real é o 403 do
// backend (`ProductLockedError`, ver `.docs/backend/market.md`). Motivo do
// bloqueio visível na própria célula (tarefa J.2), não só em
// `title`/`aria-label` (invisível em touch, baixo contraste até em
// desktop) — texto curto (`visibleText`) pra caber ao lado do ticker sem
// quebrar a coluna; frase completa continua em `aria-label`/`title` pra
// leitor de tela e hover.
export function LockedAssetBadge({ lessonCode }: LockedAssetBadgeProps) {
    const label = lessonCode ? `Produto travado, desbloqueia na lição ${lessonCode}` : 'Produto travado pela trilha'
    const visibleText = lessonCode ? `Lição ${lessonCode}` : 'Travado'

    return (
        <span className={styles.badge} title={label} aria-label={label}>
            <Locked size={14} label={visibleText} />
        </span>
    )
}
