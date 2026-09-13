import { Locked } from '../../atoms/Locked'
import styles from './index.module.css'

const LABEL = 'Produto travado pela trilha'

// Estado visual travado por linha em EquityList/FixedIncomeList (tela
// 4.2/4.4) — só o reflexo de UX; a garantia real é o 403 do backend
// (`ProductLockedError`, ver `.docs/backend/market.md`). Ícone-só, sem
// código/título de lição na célula (Fase Q, reversão da J.2): mostrar
// "Lição X.X" fora do Mapa da Trilha foi decisão revertida pelo autor —
// o motivo completo (qual lição, o que fazer) só aparece depois do clique,
// na própria tela do recurso (`AssetDetail`/`FixedIncomeDetail` viram
// parede total quando travados).
export function LockedAssetBadge() {
    return (
        <span className={styles.badge} title={LABEL} aria-label={LABEL}>
            <Locked size={14} />
        </span>
    )
}
