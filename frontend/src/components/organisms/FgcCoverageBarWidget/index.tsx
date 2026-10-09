import { useState } from 'react'
import { FGC_GLOBAL_LIMIT, FGC_LIMIT_PER_INSTITUTION, fgcCoverage } from '../../../features/lessons/widgets/fgcMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { FgcCoverageBarWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { FgcCoverageBarWidgetProps } from './types'

const toAmount = (raw: string) => {
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : 0
}

// Widget `fgc-coverage-bar` (RC.3.4b): o guarda-chuva do FGC. Cada instituição
// que quebra ganha uma barra com o trecho coberto (até R$ 250 mil) e o trecho
// descoberto (listrado); o total coberto nunca passa de R$ 1 milhão na janela de
// 4 anos, e instituições do mesmo conglomerado contam como uma só.
export function FgcCoverageBarWidget({ amountPerInstitution, institutions, sameConglomerate }: FgcCoverageBarWidgetProps) {
    const [amount, setAmount] = useState(amountPerInstitution)
    const [count, setCount] = useState(institutions)
    const [same, setSame] = useState(sameConglomerate)

    const coverage = fgcCoverage(
        Array.from({ length: count }, () => amount),
        same,
    )
    const scale = Math.max(...coverage.groups.map((group) => group.amount), FGC_LIMIT_PER_INSTITUTION)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Valor em cada instituição (R$)
                    <input
                        type="number"
                        min={0}
                        step={10000}
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(toAmount(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Instituições que quebram em 4 anos: {count}
                    <input type="range" min={1} max={6} step={1} value={count} onChange={(e) => setCount(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.presets} role="group" aria-label="Relação entre as instituições">
                <button type="button" className={styles.preset} aria-pressed={!same} onClick={() => setSame(false)}>
                    Conglomerados diferentes
                </button>
                <button type="button" className={styles.preset} aria-pressed={same} onClick={() => setSame(true)}>
                    Mesmo conglomerado
                </button>
            </div>
            <ul className={styles.bars} aria-label="Cobertura do FGC por instituição">
                {coverage.groups.map((group, index) => (
                    <li key={index} className={styles.barRow}>
                        <span className={styles.barLabel}>{same ? 'Conglomerado' : `Instituição ${index + 1}`}</span>
                        <span className={styles.stack} style={{ width: `${(group.amount / scale) * 100}%` }}>
                            <span
                                className={styles.stackCovered}
                                style={{ width: `${group.amount === 0 ? 0 : (group.covered / group.amount) * 100}%` }}
                            />
                            <span
                                className={styles.stackUncovered}
                                style={{ width: `${group.amount === 0 ? 0 : (group.uncovered / group.amount) * 100}%` }}
                            />
                        </span>
                        <span className={styles.barValue}>{formatCurrency(group.covered)}</span>
                    </li>
                ))}
            </ul>
            <ul className={styles.legend}>
                <li>
                    <span className={styles.swatchSolid} /> Coberto pelo FGC
                </li>
                <li>
                    <span className={styles.swatchStriped} /> Fora da cobertura
                </li>
            </ul>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Coberto: {formatCurrency(coverage.covered)}. Fora da cobertura: {formatCurrency(coverage.uncovered)}.
                </p>
                <p>
                    O limite é de {formatCurrency(FGC_LIMIT_PER_INSTITUTION)} por CPF e por conglomerado financeiro, e de{' '}
                    {formatCurrency(FGC_GLOBAL_LIMIT)} no total a cada 4 anos.
                </p>
                {coverage.cappedByGlobal && <p>Aqui o limite total de {formatCurrency(FGC_GLOBAL_LIMIT)} foi o que travou a cobertura.</p>}
                {same && count > 1 && <p>Instituições do mesmo conglomerado contam como uma só: os valores se somam antes do limite.</p>}
            </div>
        </div>
    )
}

export function fgcCoverageBarSummary({ amountPerInstitution, institutions, sameConglomerate }: FgcCoverageBarWidgetProps): string {
    return `Barra de cobertura do FGC: com ${formatCurrency(amountPerInstitution)} em cada uma de ${institutions} ${institutions === 1 ? 'instituição' : 'instituições'}${sameConglomerate ? ' do mesmo conglomerado' : ''}, mostra o trecho coberto (até ${formatCurrency(FGC_LIMIT_PER_INSTITUTION)} por conglomerado, ${formatCurrency(FGC_GLOBAL_LIMIT)} no total em 4 anos) e o que fica de fora.`
}
