import { useState } from 'react'
import { FACE_VALUE, mtmOutcome, pricingYears, seesawTiltDeg } from '../../../features/lessons/widgets/mtmMath'
import type { MtmIndexer } from '../../../features/lessons/widgets/mtmMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { MtmSeesawWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { MtmSeesawWidgetProps } from './types'

const pct = (value: number, digits = 2) => `${value.toFixed(digits).replace('.', ',')}%`

const INDEXER_LABEL: Record<MtmIndexer, string> = { prefixed: 'Prefixado', 'ipca-plus': 'IPCA+', selic: 'Selic' }

const SCENARIOS = [
    { label: 'Taxa sobe 1 p.p.', deltaPp: 1 },
    { label: 'Taxa sobe 2,5 p.p.', deltaPp: 2.5 },
    { label: 'Taxa cai 1 p.p.', deltaPp: -1 },
]

const clampRate = (value: number) => Math.max(2, Math.min(25, value))

// Widget `mtm-seesaw` (RC.3.4b): a gangorra da marcação a mercado. O aluno move a
// taxa que o mercado exige e vê o preço do título se mover no sentido oposto; o
// prazo restante alonga o braço (mais oscilação) e o título Selic quase não se
// mexe. Conta bruta, antes de IR e de custódia, e vale para quem vende antes do
// vencimento: quem segura recebe o combinado.
export function MtmSeesawWidget({ contractRatePct, yearsToMaturity, indexer }: MtmSeesawWidgetProps) {
    const [market, setMarket] = useState(contractRatePct)
    const [years, setYears] = useState(yearsToMaturity)
    const [kind, setKind] = useState<MtmIndexer>(indexer)

    const outcome = mtmOutcome(contractRatePct, market, pricingYears(kind, years))
    const tilt = seesawTiltDeg(contractRatePct, market)
    const direction = outcome.changePct > 0.005 ? 'sobe' : outcome.changePct < -0.005 ? 'cai' : 'fica igual'
    const rateLabel = kind === 'ipca-plus' ? 'Taxa real de mercado' : 'Taxa de mercado'

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Tipo de título">
                {(Object.keys(INDEXER_LABEL) as MtmIndexer[]).map((option) => (
                    <button
                        key={option}
                        type="button"
                        className={styles.preset}
                        aria-pressed={kind === option}
                        onClick={() => setKind(option)}
                    >
                        {INDEXER_LABEL[option]}
                    </button>
                ))}
            </div>
            <svg
                className={styles.seesawSvg}
                viewBox="0 0 320 120"
                role="img"
                aria-label={`Gangorra: com a taxa em ${pct(market)}, o preço ${direction}`}
            >
                <g className={styles.seesawBeam} style={{ transform: `rotate(${tilt}deg)` }}>
                    <line className={styles.seesawBar} x1="30" y1="80" x2="290" y2="80" />
                    <text className={styles.seesawLabel} x="30" y="68" textAnchor="start">
                        {rateLabel}
                    </text>
                    <text className={styles.seesawLabel} x="290" y="68" textAnchor="end">
                        Preço do título
                    </text>
                </g>
                <polygon className={styles.seesawPivot} points="160,84 142,112 178,112" />
            </svg>
            <label className={styles.field}>
                {rateLabel}: {pct(market)} ao ano (você comprou a {pct(contractRatePct)})
                <input type="range" min={2} max={25} step={0.25} value={market} onChange={(e) => setMarket(Number(e.target.value))} />
            </label>
            <label className={styles.field}>
                Prazo até o vencimento: {years.toFixed(2).replace('.', ',')} anos
                <input type="range" min={0.25} max={10} step={0.25} value={years} onChange={(e) => setYears(Number(e.target.value))} />
            </label>
            <div className={styles.presets} role="group" aria-label="Cenários de taxa">
                {SCENARIOS.map((scenario) => (
                    <button
                        key={scenario.label}
                        type="button"
                        className={styles.preset}
                        onClick={() => setMarket((current) => clampRate(current + scenario.deltaPp))}
                    >
                        {scenario.label}
                    </button>
                ))}
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Preço hoje: {formatCurrency(outcome.currentPrice)} (compra: {formatCurrency(outcome.purchasePrice)}), {direction}
                    {Math.abs(outcome.changePct) > 0.005 ? ` ${pct(Math.abs(outcome.changePct))}` : ''}.
                </p>
                <p>
                    Se segurar até o vencimento, recebe {formatCurrency(FACE_VALUE)} por título, seja qual for o preço no meio do caminho.
                </p>
                <p>
                    {kind === 'selic'
                        ? 'O título Selic é reprecificado todo dia pela própria Selic, por isso a gangorra quase não se mexe.'
                        : 'Quanto mais longe o vencimento, mais o preço oscila com a mesma mudança de taxa. Só vira prejuízo de verdade se você vender antes.'}
                </p>
            </div>
        </div>
    )
}

export function mtmSeesawSummary({ contractRatePct, yearsToMaturity, indexer }: MtmSeesawWidgetProps): string {
    return `Gangorra da marcação a mercado de um título ${INDEXER_LABEL[indexer]} comprado a ${pct(contractRatePct)} ao ano com ${yearsToMaturity.toFixed(2).replace('.', ',')} anos até o vencimento: ao mover a taxa de mercado de 2% a 25%, o preço se move no sentido oposto, e o prazo ajustável mostra que vencimento longo oscila mais.`
}
