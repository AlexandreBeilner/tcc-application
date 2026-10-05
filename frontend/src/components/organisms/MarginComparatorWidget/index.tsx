import { useState } from 'react'
import { formatMillions, formatPct, marginPct } from '../../../features/lessons/widgets/companyMath'
import type { CompanyMargins, MarginComparatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { MarginComparatorWidgetProps } from './types'

const FIELDS: { key: keyof CompanyMargins; label: string }[] = [
    { key: 'netRevenue', label: 'Receita líquida' },
    { key: 'grossProfit', label: 'Lucro bruto' },
    { key: 'ebit', label: 'EBIT' },
    { key: 'netIncome', label: 'Lucro líquido' },
]

const toNumber = (raw: string) => {
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
}

// Widget `margin-comparator` (RC.3.4f): duas empresas lado a lado. Cada margem é
// o resultado de uma etapa dividido pela receita líquida; o aluno edita os
// números e vê quem converte melhor cada etapa. Valores em milhões, de exemplo.
export function MarginComparatorWidget(props: MarginComparatorWidgetProps) {
    const [a, setA] = useState(props.a)
    const [b, setB] = useState(props.b)

    const rows = [
        { label: 'Margem bruta', a: marginPct(a.grossProfit, a.netRevenue), b: marginPct(b.grossProfit, b.netRevenue) },
        { label: 'Margem EBIT', a: marginPct(a.ebit, a.netRevenue), b: marginPct(b.ebit, b.netRevenue) },
        { label: 'Margem líquida', a: marginPct(a.netIncome, a.netRevenue), b: marginPct(b.netIncome, b.netRevenue) },
    ]
    const netA = rows[2].a
    const netB = rows[2].b
    const better =
        netA === netB
            ? 'As duas empresas têm a mesma margem líquida.'
            : `A empresa ${netA > netB ? 'A' : 'B'} converte mais da receita em lucro líquido.`

    const editor = (name: string, value: CompanyMargins, set: (next: CompanyMargins) => void) => (
        <div className={styles.fields} role="group" aria-label={`Empresa ${name}`}>
            {FIELDS.map((field) => (
                <label key={field.key} className={styles.field}>
                    {field.label} da {name} (R$ mi)
                    <input
                        type="number"
                        step={10}
                        inputMode="decimal"
                        value={value[field.key]}
                        onChange={(e) => set({ ...value, [field.key]: toNumber(e.target.value) })}
                    />
                </label>
            ))}
        </div>
    )

    return (
        <div className={styles.root}>
            {editor('A', a, setA)}
            {editor('B', b, setB)}
            <ul className={styles.bars} aria-label="Margens das duas empresas">
                {rows.flatMap((row) => [
                    <li key={`${row.label}-a`} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.label}, A</span>
                        <span className={styles.barTrack}>
                            <span
                                className={row.a < 0 ? styles.barFillNegative : styles.barFill}
                                style={{ width: `${Math.min(100, Math.abs(row.a))}%` }}
                            />
                        </span>
                        <span className={styles.barValue}>{formatPct(row.a)}</span>
                    </li>,
                    <li key={`${row.label}-b`} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.label}, B</span>
                        <span className={styles.barTrack}>
                            <span
                                className={row.b < 0 ? styles.barFillNegative : styles.barFill}
                                style={{ width: `${Math.min(100, Math.abs(row.b))}%` }}
                            />
                        </span>
                        <span className={styles.barValue}>{formatPct(row.b)}</span>
                    </li>,
                ])}
            </ul>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Margem líquida: A com {formatPct(netA)} e B com {formatPct(netB)}. {better}
                </p>
                <p>
                    A fatura {formatMillions(a.netRevenue)} e B fatura {formatMillions(b.netRevenue)}: o tamanho não diz quem converte
                    melhor.
                </p>
                <p>Margem só compara bem entre empresas do mesmo setor, e um lucro que não se repete pode inflar a margem de um período.</p>
            </div>
        </div>
    )
}

export function marginComparatorSummary(props: MarginComparatorWidgetProps): string {
    return `Comparador de margens: a empresa A, com receita líquida de ${formatMillions(props.a.netRevenue)}, e a B, com ${formatMillions(props.b.netRevenue)}, têm margem bruta, EBIT e líquida calculadas pela receita, e o widget mostra quem converte melhor.`
}
