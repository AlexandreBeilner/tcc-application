import { useState } from 'react'
import { BOOKBUILDING_ORDERS, bookbuilding, demandCurve } from '../../../features/lessons/widgets/equityMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { BookbuildingSimulatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { BookbuildingSimulatorWidgetProps } from './types'

const price = (cents: number) => formatCurrency(cents / 100)
const count = (value: number) => value.toLocaleString('pt-BR')

// Widget `bookbuilding-simulator` (RC.3.4e): oito investidores dizem quantas
// ações querem e o preço máximo que aceitam. A demanda acumulada vai do maior
// preço ao menor, e o preço de corte é o maior em que ela cobre a oferta. Só a
// parte primária (ações novas) vira caixa da empresa; a secundária paga os
// sócios que vendem. Ordens de exemplo, fixas.
export function BookbuildingSimulatorWidget({ offeredShares, primaryPct, existingShares }: BookbuildingSimulatorWidgetProps) {
    const [offered, setOffered] = useState(offeredShares)
    const [primary, setPrimary] = useState(primaryPct)

    const curve = demandCurve(BOOKBUILDING_ORDERS)
    const maxDemand = curve[curve.length - 1].cumulativeQty
    const result = bookbuilding(BOOKBUILDING_ORDERS, offered, primary, existingShares)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Ações ofertadas: {count(offered)}
                    <input
                        type="range"
                        min={250_000}
                        max={2_000_000}
                        step={50_000}
                        value={offered}
                        onChange={(e) => setOffered(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Parte primária (ações novas): {primary}%
                    <input type="range" min={0} max={100} step={10} value={primary} onChange={(e) => setPrimary(Number(e.target.value))} />
                </label>
            </div>
            <ul className={styles.bars} aria-label="Demanda acumulada por preço">
                {curve.map((level) => (
                    <li key={level.priceCents} className={styles.barRow}>
                        <span className={styles.barLabel}>
                            A {price(level.priceCents)} ou menos{result.cutCents === level.priceCents ? ' (corte)' : ''}
                        </span>
                        <span className={styles.barTrack}>
                            <span className={styles.barFill} style={{ width: `${(level.cumulativeQty / maxDemand) * 100}%` }} />
                        </span>
                        <span className={styles.barValue}>{count(level.cumulativeQty)}</span>
                    </li>
                ))}
            </ul>
            <div className={styles.result} aria-live="polite">
                {result.cutCents === null ? (
                    <p className={styles.headline}>A demanda não cobre a oferta: o IPO não fecha com essa quantidade de ações.</p>
                ) : (
                    <>
                        <p className={styles.headline}>
                            Preço de corte: {price(result.cutCents)}. A oferta foi coberta {result.coverage.toFixed(2).replace('.', ',')}{' '}
                            vez.
                        </p>
                        <p>
                            Entra no caixa da empresa: {formatCurrency(result.companyCash)} ({count(result.primaryShares)} ações novas).
                        </p>
                        <p>
                            Vai para os sócios que vendem: {formatCurrency(result.sellersCash)} ({count(result.secondaryShares)} ações já
                            existentes).
                        </p>
                        <p>
                            Valor de mercado depois do IPO: {formatCurrency(result.marketCap)}. Os sócios antigos ficam diluídos em{' '}
                            {result.dilutionPct.toFixed(2).replace('.', ',')}%.
                        </p>
                    </>
                )}
                <p>
                    O preço de corte é o maior preço em que a demanda acumulada cobre a oferta. Os investidores desta lista são de exemplo.
                </p>
            </div>
        </div>
    )
}

export function bookbuildingSimulatorSummary({ offeredShares, primaryPct, existingShares }: BookbuildingSimulatorWidgetProps): string {
    return `Bookbuilding de um IPO: com ${count(offeredShares)} ações ofertadas, ${primaryPct}% primárias e ${count(existingShares)} ações já existentes, mostra a demanda acumulada por preço, o preço de corte, o caixa da empresa, o que vai aos sócios vendedores e a diluição.`
}
