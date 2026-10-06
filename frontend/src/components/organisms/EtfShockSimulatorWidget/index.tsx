import { useState } from 'react'
import { etfShock } from '../../../features/lessons/widgets/proventosMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { EtfShockSimulatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { EtfShockSimulatorWidgetProps } from './types'

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`

// Widget `etf-shock-simulator` (RC.3.4g): a cesta do ETF com o peso de cada ativo. O aluno mexe na
// variação de cada ativo e vê quanto o ETF varia: soma de peso x variação. É o motivo de o ETF
// diversificar, e de o peso de cada ativo importar. O NAV por cota é o valor de uma cota da cesta.
export function EtfShockSimulatorWidget({ holdings, navBefore }: EtfShockSimulatorWidgetProps) {
    const [shocks, setShocks] = useState<number[]>(() => holdings.map(() => 0))
    const result = etfShock(holdings, shocks, navBefore)

    const setShock = (index: number, value: number) => setShocks((current) => current.map((old, i) => (i === index ? value : old)))

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Cenários">
                <button type="button" className={styles.preset} onClick={() => setShocks(holdings.map((_, i) => (i === 0 ? -20 : 0)))}>
                    {holdings[0]?.name} cai 20%
                </button>
                <button type="button" className={styles.preset} onClick={() => setShocks(holdings.map(() => -10))}>
                    Todos caem 10%
                </button>
                <button type="button" className={styles.preset} onClick={() => setShocks(holdings.map(() => 0))}>
                    Zerar
                </button>
            </div>
            <ul className={styles.bars}>
                {holdings.map((holding, index) => (
                    <li key={holding.name} className={styles.barRow}>
                        <label className={styles.field}>
                            {holding.name}, {holding.weightPct}% da cesta: {signed(shocks[index])}
                            <input
                                type="range"
                                min={-50}
                                max={30}
                                step={5}
                                value={shocks[index]}
                                onChange={(e) => setShock(index, Number(e.target.value))}
                            />
                        </label>
                        <span className={styles.barValue}>{signed(result.contributions[index])} no ETF</span>
                    </li>
                ))}
            </ul>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    O ETF varia {signed(result.changePct)}: a cota vai de {formatCurrency(navBefore)} para {formatCurrency(result.navAfter)}
                    .
                </p>
                <p>A conta é a soma de peso x variação de cada ativo. Um ativo com 40% da cesta que cai 20% derruba o ETF em 8%.</p>
            </div>
        </div>
    )
}

export function etfShockSimulatorSummary({ holdings }: EtfShockSimulatorWidgetProps): string {
    return `Choque em ETF: uma cesta de ${holdings.length} ativos com pesos de ${holdings.map((h) => `${h.weightPct}%`).join(', ')}. Mexa na variação de cada ativo e veja quanto o ETF varia.`
}
