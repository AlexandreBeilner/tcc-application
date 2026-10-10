import { formatUpdatedAgo } from '../../utils/formatUpdatedAgo'
import { useState } from 'react'
import { RankingBoard } from '../../components/organisms/RankingBoard'
import { useRankingQuery } from '../../features/ranking/useRankingQuery'
import { useAuth } from '../../features/auth/AuthContext'
import type { RankingCriterion, RankingScope, RankingWindow } from '../../services/ranking'
import styles from './index.module.css'

const SCOPE_OPTIONS: { value: RankingScope; label: string }[] = [
    { value: 'global', label: 'Todos' },
    { value: 'friends', label: 'Amigos' },
]

const CRITERION_OPTIONS: { value: RankingCriterion; label: string }[] = [
    { value: 'overall', label: 'Geral' },
    { value: 'fixedIncome', label: 'Renda fixa' },
    { value: 'variableIncome', label: 'Renda variável' },
    { value: 'level', label: 'Nível' },
]

const WINDOW_OPTIONS: { value: RankingWindow; label: string }[] = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
]

interface PillGroupProps<T extends string> {
    label: string
    options: { value: T; label: string }[]
    value: T
    onChange: (value: T) => void
    disabled?: boolean
    disabledReason?: string
}

// Grupo de pills reaproveitado pelos 3 filtros da tela — nenhum grupo
// nunca some do layout (achado desta sessão: o `Select` de Janela
// desaparecendo no critério "Nível" fazia o grupo de Critério "pular" de
// lugar). Um grupo pode ficar `disabled` (Janela no critério Nível) sem
// deixar de ocupar espaço, então nada ao redor se move.
function PillGroup<T extends string>({ label, options, value, onChange, disabled, disabledReason }: PillGroupProps<T>) {
    return (
        <div className={styles.filterGroup}>
            <span className={styles.groupLabel}>{label}</span>
            <div className={styles.pillRow} title={disabled ? disabledReason : undefined}>
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        aria-disabled={disabled}
                        className={[styles.pill, option.value === value && styles.pillActive, disabled && styles.pillDisabled]
                            .filter(Boolean)
                            .join(' ')}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

// Tela 7.1 (RF17) — os 3 filtros (escopo, critério de classificação —
// 6.8.3 — e janela) são sempre pills sempre visíveis, nunca um `Select`
// escondido: com 4 opções de critério, um `Select` some de vista assim que
// fecha, e a Janela sumindo do layout no critério "Nível" fazia os
// controles ao lado saltarem de posição (achado apontado pelo autor nesta
// sessão). Em vez de esconder a Janela, ela fica presente e desabilitada
// (com `title` explicando o motivo) quando o critério é "Nível" — o
// layout nunca reflui. Composição responsiva (identidade-visual-padroes.md
// §7): mobile/tablet reúne os 3 grupos numa barra horizontal acima do
// conteúdo; desktop (≥1024px) vira um painel lateral fixo/sticky, mesmo
// padrão de "conteúdo principal + coluna de apoio" já usado em
// `pages/Track`/`pages/AssetDetail`.
export function Classificacao() {
    const { user } = useAuth()
    const [window, setWindow] = useState<RankingWindow>('week')
    const [scope, setScope] = useState<RankingScope>('global')
    const [criterion, setCriterion] = useState<RankingCriterion>('overall')
    const [page, setPage] = useState(1)
    const rankingQuery = useRankingQuery(window, scope, criterion, page)
    const windowDisabled = criterion === 'level'

    function changeScope(next: RankingScope) {
        setScope(next)
        setPage(1)
    }

    function changeCriterion(next: RankingCriterion) {
        setCriterion(next)
        setPage(1)
    }

    function changeWindow(next: RankingWindow) {
        if (windowDisabled) return
        setWindow(next)
        setPage(1)
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Classificação</h1>

            <div className={styles.layout}>
                <div className={styles.main}>
                    <p className={styles.note}>
                        Só o patrimônio do Mercado Ao Vivo conta pro ranking. O Sandbox não entra.
                        {rankingQuery.data?.updatedAt &&
                            ` ${formatUpdatedAgo(rankingQuery.data.updatedAt)}, a classificação é recalculada a cada 3 horas.`}
                    </p>
                    <p className={styles.note}>
                        A renda fixa entra pelo valor de hoje, já descontado o Imposto de Renda, como se você resgatasse. Quem acabou de
                        entrar vê a própria posição na hora, mesmo antes da próxima atualização.
                    </p>

                    {rankingQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar a classificação agora. Tente novamente em instantes.
                        </p>
                    )}

                    {!rankingQuery.data && !rankingQuery.isError && <p className={styles.loading}>Carregando classificação…</p>}

                    {rankingQuery.data && (
                        <RankingBoard
                            entries={rankingQuery.data.entries}
                            scope={scope}
                            criterion={criterion}
                            currentUserId={user?.id ?? null}
                            requestingUserPosition={rankingQuery.data.requestingUserPosition}
                            page={rankingQuery.data.page}
                            pageSize={rankingQuery.data.pageSize}
                            totalEntries={rankingQuery.data.totalEntries}
                            totalPages={rankingQuery.data.totalPages}
                            onPageChange={setPage}
                        />
                    )}
                </div>

                <aside className={styles.filters} aria-label="Filtros da classificação">
                    <PillGroup label="Escopo" options={SCOPE_OPTIONS} value={scope} onChange={changeScope} />
                    <PillGroup label="Critério" options={CRITERION_OPTIONS} value={criterion} onChange={changeCriterion} />
                    <PillGroup
                        label="Janela"
                        options={WINDOW_OPTIONS}
                        value={window}
                        onChange={changeWindow}
                        disabled={windowDisabled}
                        disabledReason="Não se aplica ao critério Nível: nível é cumulativo desde sempre."
                    />
                </aside>
            </div>
        </main>
    )
}
