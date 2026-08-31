import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatSignedPercent } from '../../../features/market/format'
import { computePodiumSparkline, PODIUM_SPARKLINE_HEIGHT, PODIUM_SPARKLINE_WIDTH } from '../../../features/ranking/podiumSparkline'
import { useValueFlash } from '../../../features/ranking/useValueFlash'
import { Button } from '../../atoms/Button'
import { Pagination } from '../../molecules/Pagination'
import type { RankingCriterion, RankingEntry } from '../../../services/ranking'
import type { RankingBoardProps } from './types'
import styles from './index.module.css'

export type { RankingBoardProps } from './types'

const RANK_LABEL = ['1º', '2º', '3º']

const EMPTY_MESSAGE: Record<RankingCriterion, string> = {
    overall: 'Ninguém no ranking ainda.',
    fixedIncome: 'Ninguém com posição em renda fixa nesta janela ainda.',
    variableIncome: 'Ninguém com posição em renda variável nesta janela ainda.',
    level: 'Ninguém no ranking ainda.',
}

function profitClassName(pct: number): string {
    if (pct > 0) return styles.gain
    if (pct < 0) return styles.loss
    return styles.neutral
}

function initials(username: string): string {
    return username.charAt(0).toUpperCase()
}

function sparklineIsGain(pct: number): boolean {
    return pct >= 0
}

// Único ponto que decide "XP ou rentabilidade" por critério — usado tanto
// pro flash de valor quanto pro bloco renderizado, pra não correr risco de
// um dos dois ficar desatualizado quando um 5º critério for adicionado.
function criterionValue(entry: RankingEntry, criterion: RankingCriterion): number | null {
    return criterion === 'level' ? entry.xp : entry.profitabilityPct
}

// Sparkline por card do pódio (tarefa 6.8.4, mockup em
// identidade-visual-padroes.md) — 2 âncoras reais (início da janela = 0%,
// agora = `pct`) com ruído determinístico entre elas (`podiumSparkline`,
// mesmo princípio do Mapa da Trilha, §4), sobre um grid de fundo tipo
// "papel de gráfico" (§2). Não renderiza pro critério `level` (não existe
// rentabilidade nesse critério).
function PodiumSparkline({ seedKey, pct }: { seedKey: string; pct: number }) {
    const patternId = useId()
    const { linePath, fillPath } = computePodiumSparkline(seedKey, pct)
    const isGain = sparklineIsGain(pct)
    const colorVar = isGain ? 'var(--color-gain-500)' : 'var(--color-loss-500)'

    return (
        <svg
            className={styles.sparkline}
            viewBox={`0 0 ${PODIUM_SPARKLINE_WIDTH} ${PODIUM_SPARKLINE_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <pattern id={patternId} width="14" height="10" patternUnits="userSpaceOnUse">
                <path d="M14 0 L0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            </pattern>
            <rect x={0} y={0} width={PODIUM_SPARKLINE_WIDTH} height={PODIUM_SPARKLINE_HEIGHT} fill={`url(#${patternId})`} />
            <path d={fillPath} fill={colorVar} opacity={0.16} />
            <path d={linePath} fill="none" stroke={colorVar} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// Tela 7.1 (RF17) — pódio (top 3 da página 1, ordem visual 2º-1º-3º via
// `order` no CSS) + lista paginada (6.8.2). Decisão de responsividade da
// 6.8: pódio **compacta horizontalmente** em mobile em vez de empilhar
// verticalmente — continua 3 colunas lado a lado, só mais estreitas —
// porque empilhar destruiria a leitura de "pódio". Redesenho "home broker"
// da 6.8.4: pedestal com altura física real por posição (1º/2º/3º),
// dourado (teatro de recompensa, §6) reservado pro pedestal/avatar do 1º
// lugar — nunca no número de rentabilidade, que continua verde/vermelho
// mesmo no 1º lugar negativo (grupo pequeno no vermelho não pode "quebrar"
// a leitura do pódio).
export function RankingBoard({
    entries,
    scope,
    criterion,
    currentUserId,
    requestingUserPosition,
    page,
    pageSize,
    totalEntries,
    totalPages,
    onPageChange,
}: RankingBoardProps) {
    const navigate = useNavigate()
    const flashValues = new Map(entries.map((entry) => [entry.userId, criterionValue(entry, criterion)]))
    const flashingIds = useValueFlash(flashValues)

    // `GET /ranking` nunca erra pro escopo Amigos sem amigos aceitos — só
    // devolve o próprio usuário sozinho na lista (`.docs/backend/ranking.md`).
    // Checa `totalEntries` (não `entries.length`, que é só a página atual)
    // — CTA leva pro hub de Amigos (8.1, `/amigos`, tarefa 6.9).
    if (scope === 'friends' && totalEntries <= 1) {
        return (
            <div className={styles.emptyState}>
                <p className={styles.emptyBody}>Você ainda não tem amigos no ranking. Adicione amigos pra comparar rentabilidade.</p>
                <Button variant="secondary" onClick={() => navigate('/amigos')}>
                    Buscar amigos
                </Button>
            </div>
        )
    }

    if (totalEntries === 0) {
        return <p className={styles.emptyBody}>{EMPTY_MESSAGE[criterion]}</p>
    }

    const podium = page === 1 ? entries.slice(0, 3) : []
    const rest = page === 1 ? entries.slice(3) : entries
    const restRankOffset = page === 1 ? 4 : (page - 1) * pageSize + 1

    function rowClass(entry: RankingEntry, base: string): string {
        return [base, entry.userId === currentUserId && styles.own].filter(Boolean).join(' ')
    }

    function valueBlock(entry: RankingEntry, pctClassName: string) {
        if (criterion === 'level') {
            return <span className={`${pctClassName} tabular-nums ${styles.xpValue}`}>{entry.xp.toLocaleString('pt-BR')} XP</span>
        }
        return (
            <span
                className={`${pctClassName} tabular-nums ${profitClassName(entry.profitabilityPct as number)} ${flashingIds.has(entry.userId) ? styles.flash : ''}`}
            >
                {formatSignedPercent(entry.profitabilityPct as number)}
            </span>
        )
    }

    return (
        <div className={styles.board}>
            {requestingUserPosition !== null && <p className={styles.selfPosition}>Você está em Nº {requestingUserPosition}</p>}

            {podium.length > 0 && (
                <div className={styles.podium}>
                    {podium.map((entry, index) => (
                        <div key={entry.userId} className={`${styles.slot} ${styles[`slot${index + 1}`]}`}>
                            <div className={rowClass(entry, `${styles.card} ${styles[`card${index + 1}`]}`)}>
                                <span className={styles.medal}>{RANK_LABEL[index]} lugar</span>
                                <span className={styles.avatar}>{initials(entry.username)}</span>
                                <span className={styles.podiumName}>{entry.username}</span>
                                <span className={styles.podiumLevel}>Nível {entry.level}</span>
                                {criterion !== 'level' && (
                                    <PodiumSparkline seedKey={`${entry.userId}:${criterion}`} pct={entry.profitabilityPct as number} />
                                )}
                                {valueBlock(entry, styles.podiumPct)}
                            </div>
                            <div className={styles.pedestal} aria-hidden="true">
                                {RANK_LABEL[index]}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {rest.length > 0 && (
                <ul className={styles.list}>
                    {rest.map((entry, index) => (
                        <li key={entry.userId} className={rowClass(entry, styles.row)}>
                            <span className={styles.rowRank}>{restRankOffset + index}º</span>
                            <span className={styles.rowName}>{entry.username}</span>
                            <span className={styles.rowLevel}>Nível {entry.level}</span>
                            {valueBlock(entry, styles.rowPct)}
                        </li>
                    ))}
                </ul>
            )}

            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
    )
}
