import { useEffect, useState } from 'react'
import { equivalentGrossRatePct, irRatePctForDays, netRatePct } from '../../../features/lessons/widgets/fixedIncomeMath'
import type { EquivalentRateWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { EquivalentRateWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`

// Widget `equivalent-rate` (RC.3.4a): a conta da taxa bruta equivalente feita
// pelo próprio widget. O aluno troca o prazo (presets ou campo livre) e vê o
// vencedor virar; nenhuma conta fora da tela.
export function EquivalentRateWidget({ exemptRatePct, cdbRatePct, daysPresets, onMetrics }: EquivalentRateWidgetProps) {
    const [exempt, setExempt] = useState(exemptRatePct)
    const [cdb, setCdb] = useState(cdbRatePct)
    const [days, setDays] = useState(daysPresets[0] ?? 180)

    const valid = exempt > 0 && cdb > 0 && days >= 1
    const irRate = irRatePctForDays(days)
    const equivalent = valid ? equivalentGrossRatePct(exempt, irRate) : 0
    const cdbNet = valid ? netRatePct(cdb, irRate) : 0
    const cdbWins = cdbNet > exempt
    // Quanto o CDB líquido rende a mais (ou a menos) que o produto isento, em pontos percentuais.
    const cdbGapPct = valid ? cdbNet - exempt : Infinity
    useEffect(() => onMetrics?.({ cdbGapPct }), [cdbGapPct, onMetrics])

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Prazo da aplicação">
                {daysPresets.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        className={styles.preset}
                        aria-pressed={days === preset}
                        onClick={() => setDays(preset)}
                    >
                        {preset} dias
                    </button>
                ))}
            </div>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Taxa isenta (% ao ano)
                    <input type="number" min={0} step="0.01" value={exempt || ''} onChange={(e) => setExempt(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Taxa do CDB (% ao ano)
                    <input type="number" min={0} step="0.01" value={cdb || ''} onChange={(e) => setCdb(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Prazo (dias)
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={days || ''}
                        onChange={(e) => setDays(Math.trunc(Number(e.target.value)))}
                    />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                {valid ? (
                    <>
                        <p>Imposto de renda neste prazo: {pct(irRate)}</p>
                        <p>
                            Taxa bruta equivalente: {pct(exempt)} dividido por (1 menos {pct(irRate)}) = <strong>{pct(equivalent)}</strong>
                        </p>
                        <p>
                            CDB de {pct(cdb)} bruto rende {pct(cdbNet)} líquido.
                        </p>
                        <p className={styles.headline}>
                            {cdbWins
                                ? `O CDB vence: ${pct(cdb)} é maior que a taxa equivalente de ${pct(equivalent)}.`
                                : `O produto isento vence: o CDB precisaria pagar ${pct(equivalent)}, e paga ${pct(cdb)}.`}
                        </p>
                    </>
                ) : (
                    <p>Informe taxas e prazo maiores que zero.</p>
                )}
            </div>
        </div>
    )
}

export function equivalentRateSummary({ exemptRatePct, cdbRatePct }: EquivalentRateWidgetProps): string {
    return `Calculadora de taxa bruta equivalente: compara um produto isento de ${pct(exemptRatePct)} com um CDB de ${pct(cdbRatePct)} em diferentes prazos.`
}
