import { useNavigate } from 'react-router-dom'
import { useMyAccountQuery } from '../portfolio/useMyAccountQuery'
import { useProgressionQuery } from '../portfolio/useProgressionQuery'
import { useStreakQuery } from '../portfolio/useStreakQuery'
import { useLessonsQuery } from '../portfolio/useLessonsQuery'
import { NetWorthCards } from '../portfolio/NetWorthCards'
import { ProgressionSummary } from '../portfolio/ProgressionSummary'
import { DistributionChart } from '../portfolio/DistributionChart'
import { ResumeLessonCard } from '../portfolio/ResumeLessonCard'
import { groupPositionsByCategory } from '../portfolio/distribution'
import styles from './Portfolio.module.css'

// Tela 2.1 (tarefa 6.3) — tela padrão pós-login recorrente, montada em "/"
// (substitui o placeholder `Home.tsx`). Combina 4 queries independentes
// (conta, progressão, streak, lições) — cada uma com seu próprio loading,
// sem bloquear a tela inteira numa única tela de carregamento: os cards
// que já resolveram aparecem, os que faltam mostram "Carregando…" no
// próprio espaço.
export function Portfolio() {
  const navigate = useNavigate()
  const accountQuery = useMyAccountQuery()
  const progressionQuery = useProgressionQuery()
  const streakQuery = useStreakQuery()
  const lessonsQuery = useLessonsQuery()

  const account = accountQuery.data
  const hasNoPositions =
    account && account.positions.length === 0 && account.fixedIncomePositions.length === 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Portfólio</h1>
        {progressionQuery.data && streakQuery.data ? (
          <ProgressionSummary progression={progressionQuery.data} streak={streakQuery.data} />
        ) : (
          !progressionQuery.isError &&
          !streakQuery.isError && <span className={styles.loading}>Carregando…</span>
        )}
      </header>

      {accountQuery.isError && (
        <p className={styles.error} role="alert">
          Não foi possível carregar sua conta agora. Tente novamente em instantes.
        </p>
      )}

      {!account && !accountQuery.isError && <p className={styles.loading}>Carregando conta…</p>}

      {account && <NetWorthCards account={account} />}

      {hasNoPositions && (
        <section className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Você ainda não tem nenhuma posição</h2>
          <p className={styles.emptyBody}>
            Comece pela Trilha pra entender os produtos antes de investir, ou vá direto pro Mercado
            se já sabe o que procura.
          </p>
          <div className={styles.emptyActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate('/trilha')}
            >
              Ir pra Trilha
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => navigate('/mercado')}
            >
              Ir pro Mercado
            </button>
          </div>
        </section>
      )}

      {account && !hasNoPositions && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Distribuição</h2>
          <DistributionChart
            slices={groupPositionsByCategory(account.positions, account.fixedIncomePositions)}
          />
        </section>
      )}

      {lessonsQuery.data && <ResumeLessonCard lessons={lessonsQuery.data.lessons} />}

      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={() => navigate('/mercado')}>
          Investir
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => navigate('/conquistas')}
        >
          Conquistas
        </button>
      </div>
    </main>
  )
}
