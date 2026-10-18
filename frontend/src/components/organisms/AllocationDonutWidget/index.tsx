import { useEffect, useState } from 'react'
import {
    ALLOCATION_CLASSES,
    EXAMPLE_ALLOCATIONS,
    PROFILE_LABEL,
    allocationTotal,
    badYearLoss,
    normalizedShares,
} from '../../../features/lessons/widgets/riskMath'
import type { Allocation, AllocationClass, RiskProfile } from '../../../features/lessons/widgets/riskMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { AllocationDonutWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'
import chart from './index.module.css'

export type { AllocationDonutWidgetProps } from './types'

const RADIUS = 40
const CIRC = 2 * Math.PI * RADIUS
const COLORS: Record<AllocationClass, string> = {
    'post-fixed': 'var(--color-track-0)',
    'longer-fixed': 'var(--color-track-1)',
    fii: 'var(--color-track-3)',
    stocks: 'var(--color-track-2)',
}

const pct = (value: number) => `${value.toFixed(1).replace('.', ',').replace(',0', '')}%`

// Widget `allocation-donut` (RC.3.4h): como o dinheiro se divide entre quatro classes. Parte de
// um exemplo por perfil (não é recomendação) e deixa o aluno mexer nos pesos. Cada fatia tem o
// percentual escrito na legenda, e o ano ruim ilustrativo mostra a perda em % e em reais.
export function AllocationDonutWidget({ onMetrics, ...props }: AllocationDonutWidgetProps) {
    // Os pesos de partida podem vir de uma missão (ou do "Me mostra"); sem eles, parte do exemplo do perfil.
    const startOverride = {
        ...(props.postFixedPct === undefined ? {} : { 'post-fixed': props.postFixedPct }),
        ...(props.longerFixedPct === undefined ? {} : { 'longer-fixed': props.longerFixedPct }),
        ...(props.fiiPct === undefined ? {} : { fii: props.fiiPct }),
        ...(props.stocksPct === undefined ? {} : { stocks: props.stocksPct }),
    }
    const [profile, setProfile] = useState<RiskProfile | 'custom'>(Object.keys(startOverride).length > 0 ? 'custom' : props.profile)
    const [allocation, setAllocation] = useState<Allocation>({ ...EXAMPLE_ALLOCATIONS[props.profile], ...startOverride })

    const total = allocationTotal(allocation)
    const shares = normalizedShares(allocation)
    // Maior fatia da carteira; só vale com a soma fechada em 100%, senão o donut é proporcional e a conta não é do aluno.
    const maxSharePct = total === 100 ? Math.max(...ALLOCATION_CLASSES.map(({ key }) => allocation[key])) : Infinity
    useEffect(() => onMetrics?.({ maxSharePct }), [maxSharePct, onMetrics])
    const loss = badYearLoss(allocation, props.amount)

    let offset = 0
    const arcs = ALLOCATION_CLASSES.map(({ key }) => {
        const length = (shares[key] / 100) * CIRC
        const arc = { key, length, offset }
        offset += length
        return arc
    })

    function choose(next: RiskProfile) {
        setProfile(next)
        setAllocation(EXAMPLE_ALLOCATIONS[next])
    }

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Exemplo de divisão por perfil">
                {(Object.keys(PROFILE_LABEL) as RiskProfile[]).map((p) => (
                    <button key={p} type="button" className={styles.preset} aria-pressed={profile === p} onClick={() => choose(p)}>
                        {PROFILE_LABEL[p]}
                    </button>
                ))}
            </div>
            <svg className={chart.donut} viewBox="0 0 100 100" role="img" aria-label="Divisão da carteira entre as classes de ativos">
                <g transform="rotate(-90 50 50)">
                    {arcs.map((arc) => (
                        <circle
                            key={arc.key}
                            className={chart.ring}
                            cx={50}
                            cy={50}
                            r={RADIUS}
                            stroke={COLORS[arc.key]}
                            strokeDasharray={`${arc.length} ${CIRC - arc.length}`}
                            strokeDashoffset={-arc.offset}
                        />
                    ))}
                </g>
                <text className={chart.centerText} x={50} y={54}>
                    {pct(total)}
                </text>
            </svg>
            <div className={styles.fields}>
                {ALLOCATION_CLASSES.map(({ key, label }) => (
                    <label key={key} className={styles.field}>
                        <span className={chart.legendRow}>
                            <span className={chart.swatch} style={{ background: COLORS[key] }} aria-hidden="true" />
                            {label}: {pct(allocation[key])}
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={allocation[key]}
                            onChange={(e) => {
                                setProfile('custom')
                                setAllocation((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                            }}
                        />
                    </label>
                ))}
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {total === 100
                        ? 'A soma fecha em 100%.'
                        : `A soma está em ${pct(total)}. Ajuste para chegar a 100%; as fatias abaixo são proporcionais.`}
                </p>
                <p>
                    Num ano ruim ilustrativo, essa divisão perde cerca de {pct(loss.lossPct)}, ou {formatCurrency(loss.lossAmount)} de{' '}
                    {formatCurrency(props.amount)}.
                </p>
                <p>
                    As divisões por perfil são exemplos para mostrar a ideia, não recomendação. As quedas do ano ruim também são
                    ilustrativas.
                </p>
            </div>
        </div>
    )
}

export function allocationDonutSummary({ amount }: AllocationDonutWidgetProps): string {
    return `Gráfico de rosca com a divisão de ${formatCurrency(amount)} entre ${ALLOCATION_CLASSES.map((c) => c.label.toLowerCase()).join(', ')}: parte de um exemplo por perfil (conservador, moderado ou arrojado), deixa ajustar cada peso e mostra a perda de um ano ruim ilustrativo em porcentagem e em reais.`
}
