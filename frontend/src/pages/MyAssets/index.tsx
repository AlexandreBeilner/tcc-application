import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '../../components/atoms/Button'
import { Delta } from '../../components/atoms/Delta'
import { Select } from '../../components/atoms/Select'
import { PositionsList } from '../../components/organisms/PositionsList'
import { formatCurrency } from '../../features/portfolio/format'
import { buildPortfolioReturns } from '../../features/portfolio/positionReturns'
import type { PortfolioSummary } from '../../features/portfolio/positionReturns'
import {
    POSITION_FILTERS,
    POSITION_SORTS,
    filterAndSortPositions,
    parsePositionFilter,
    parsePositionSort,
    positionDetailPath,
} from '../../features/portfolio/positionsView'
import { useMyAccountQuery } from '../../features/portfolio/useMyAccountQuery'
import styles from './index.module.css'

const sortOptions = POSITION_SORTS.map((sort) => ({ value: sort.key, label: sort.label }))

function Summary({ summary, learning }: { summary: PortfolioSummary; learning: boolean }) {
    return (
        <section className={styles.summary} aria-label="Resumo da carteira">
            <div className={styles.stat}>
                <span className={styles.statLabel}>{learning ? 'Valor atual no aprendizado' : 'Valor atual das posições'}</span>
                <span className={`${styles.statValue} tabular-nums`}>{formatCurrency(summary.currentValue)}</span>
                <span className={`${styles.statHint} tabular-nums`}>Custo: {formatCurrency(summary.cost)}</span>
            </div>
            <div className={styles.stat}>
                <span className={styles.statLabel}>Resultado total</span>
                <span className={styles.statDelta}>
                    <Delta
                        percent={summary.totalResultRatio === null ? null : summary.totalResultRatio * 100}
                        amount={summary.totalResultAmount}
                        variant="chip"
                    />
                </span>
                <span className={styles.statHint}>Valor atual menos o custo, mais os proventos.</span>
            </div>
            <div className={styles.stat}>
                <span className={styles.statLabel}>Proventos recebidos</span>
                <span className={`${styles.statValue} tabular-nums`}>{formatCurrency(summary.dividendsReceived)}</span>
                <span className={styles.statHint}>Só ações e FIIs pagam provento.</span>
            </div>
        </section>
    )
}

// Tela "Meus ativos" (MO.8.3): todos os ativos que o jogador possui e quanto cada um rendeu desde a
// compra (contra o preço médio). Mercado Ao Vivo e Modo Aprendizado em abas separadas: o aprendizado
// nunca entra nos totais do mercado ao vivo (RF12/RNF08). Aba, filtro e ordem vivem na URL.
export function MyAssets() {
    const navigate = useNavigate()
    const accountQuery = useMyAccountQuery()
    const [searchParams, setSearchParams] = useSearchParams()
    const learning = searchParams.get('aba') === 'aprendizado'
    const filter = parsePositionFilter(searchParams.get('categoria'))
    const sort = parsePositionSort(searchParams.get('ordem'))

    const portfolio = useMemo(() => (accountQuery.data ? buildPortfolioReturns(accountQuery.data) : null), [accountQuery.data])
    const group = portfolio ? (learning ? portfolio.sandbox : portfolio.live) : []
    const summary = portfolio ? (learning ? portfolio.sandboxSummary : portfolio.liveSummary) : null
    const visible = useMemo(() => filterAndSortPositions(group, filter, sort), [group, filter, sort])

    function update(changes: Record<string, string | null>) {
        const next = new URLSearchParams(searchParams)
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key)
            else next.set(key, value)
        }
        setSearchParams(next, { replace: true })
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Meus ativos</h1>
                <Link to="/extrato" className={styles.extractLink}>
                    Ver extrato completo
                </Link>
            </header>

            <div className={styles.tabs} role="tablist" aria-label="Escopo da carteira">
                <button
                    type="button"
                    role="tab"
                    aria-selected={!learning}
                    className={[styles.tab, !learning && styles.tabActive].filter(Boolean).join(' ')}
                    onClick={() => update({ aba: null })}
                >
                    Mercado Ao Vivo
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={learning}
                    className={[styles.tab, learning && styles.tabActive].filter(Boolean).join(' ')}
                    onClick={() => update({ aba: 'aprendizado' })}
                >
                    Modo Aprendizado
                </button>
            </div>

            {learning && (
                <p className={styles.learningNote}>
                    Posições de treino das lições. Não contam para o ranking nem para o patrimônio do mercado ao vivo.
                </p>
            )}

            {accountQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar seus ativos agora. Tente novamente em instantes.
                </p>
            )}

            {!accountQuery.data && !accountQuery.isError && (
                <div className={styles.skeleton} role="status" aria-label="Carregando seus ativos" />
            )}

            {summary && (
                <>
                    <Summary summary={summary} learning={learning} />

                    {group.length === 0 ? (
                        <section className={styles.empty}>
                            <span className={styles.emptyIcon} aria-hidden="true">
                                <Compass size={22} strokeWidth={2} />
                            </span>
                            <h2 className={styles.emptyTitle}>
                                {learning ? 'Nenhuma posição de treino ainda' : 'Você ainda não tem nenhum ativo'}
                            </h2>
                            <p className={styles.emptyBody}>
                                {learning
                                    ? 'As lições da Trilha abrem posições de treino para você praticar sem risco.'
                                    : 'Comece pela Trilha para entender os produtos, ou vá direto ao Mercado se já sabe o que procura.'}
                            </p>
                            <div className={styles.emptyActions}>
                                <Button variant="secondary" onClick={() => navigate('/trilha')}>
                                    Ir pra Trilha
                                </Button>
                                {!learning && <Button onClick={() => navigate('/mercado')}>Ir pro Mercado</Button>}
                            </div>
                        </section>
                    ) : (
                        <>
                            <div className={styles.controls}>
                                <div className={styles.filters} role="group" aria-label="Filtrar por categoria">
                                    {POSITION_FILTERS.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            aria-pressed={filter === item.key}
                                            className={[styles.pill, filter === item.key && styles.pillActive].filter(Boolean).join(' ')}
                                            onClick={() => update({ categoria: item.key === 'todas' ? null : item.key })}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <label className={styles.sort}>
                                    Ordenar por
                                    <Select
                                        value={sort}
                                        onChange={(value) => update({ ordem: value === 'valor' ? null : value })}
                                        options={sortOptions}
                                    />
                                </label>
                            </div>

                            {visible.length === 0 ? (
                                <p className={styles.noMatch}>Nenhum ativo nesta categoria.</p>
                            ) : (
                                <PositionsList rows={visible} onSelect={(row) => navigate(positionDetailPath(row))} />
                            )}

                            <p className={styles.help}>
                                <strong>Preço médio</strong> é quanto você pagou, em média, por unidade. <strong>Resultado</strong> compara
                                o valor de hoje com o que você aplicou, sem contar proventos.
                            </p>
                        </>
                    )}
                </>
            )}
        </main>
    )
}
