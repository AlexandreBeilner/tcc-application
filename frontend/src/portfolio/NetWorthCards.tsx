import { useNavigate } from 'react-router-dom'
import type { MyAccount } from '../api/market'
import { calculateAccountTotals } from './accountTotals'
import { formatCurrency } from './format'
import styles from './NetWorthCards.module.css'

interface NetWorthCardsProps {
  account: MyAccount
}

// Tela 2.1 (inventário) pede "variação percentual" no card de mercado ao
// vivo — fora de escopo aqui: `GET /market/me/account` devolve preço médio
// de aquisição por posição, não o preço atual (marcação a mercado exigiria
// uma chamada a `GET /market/assets/:id` por posição, escopo da 6.5, não
// desta tarefa). Os cards mostram patrimônio a custo em vez de variação.
export function NetWorthCards({ account }: NetWorthCardsProps) {
  const navigate = useNavigate()
  const { liveInvested, sandboxInvested } = calculateAccountTotals(
    account.positions,
    account.fixedIncomePositions,
  )
  const livePatrimony = account.cashBalance + liveInvested

  return (
    <div className={styles.cards}>
      <button
        type="button"
        className={styles.card}
        onClick={() => navigate('/extrato')}
        aria-label="Ver extrato do mercado ao vivo"
      >
        <span className={styles.label}>Mercado Ao Vivo</span>
        <span className={`${styles.total} tabular-nums`}>{formatCurrency(livePatrimony)}</span>
        <span className={styles.detail}>
          Investido: <span className="tabular-nums">{formatCurrency(liveInvested)}</span>
        </span>
        <span className={styles.detail}>
          Saldo em caixa:{' '}
          <span className="tabular-nums">{formatCurrency(account.cashBalance)}</span>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.card} ${styles.sandbox}`}
        onClick={() => navigate('/extrato')}
        aria-label="Ver extrato do modo aprendizado"
      >
        <span className={styles.sandboxBadge}>Modo Aprendizado</span>
        <span className={styles.label}>Sandbox</span>
        <span className={`${styles.total} tabular-nums`}>{formatCurrency(sandboxInvested)}</span>
        <span className={styles.detail}>Não conta pro ranking</span>
      </button>
    </div>
  )
}
