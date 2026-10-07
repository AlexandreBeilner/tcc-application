import { useState } from 'react'
import { PROFILE_LABEL, PROFILE_MAX_VOLATILITY, RISK_PRODUCTS, productsWithin } from '../../../features/lessons/widgets/riskMath'
import type { ProductId, RiskProfile } from '../../../features/lessons/widgets/riskMath'
import type { RiskReturnScatterWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'
import chart from './index.module.css'

export type { RiskReturnScatterWidgetProps } from './types'

const WIDTH = 320
const HEIGHT = 200
const PAD_L = 28
const PAD_B = 22
const PAD_T = 10
const PAD_R = 14
const X_MAX = 24
const Y_MIN = 5
const Y_MAX = 16

const x = (vol: number) => PAD_L + (vol / X_MAX) * (WIDTH - PAD_L - PAD_R)
const y = (ret: number) => HEIGHT - PAD_B - ((ret - Y_MIN) / (Y_MAX - Y_MIN)) * (HEIGHT - PAD_B - PAD_T)
const pct = (value: number) => `${value.toFixed(1).replace('.', ',').replace(',0', '')}%`

type ProfileChoice = 'none' | RiskProfile

// Widget `risk-return-scatter` (RC.3.4h): oscilação (risco) no eixo horizontal e retorno esperado
// no vertical, para seis tipos de investimento. Os números são ilustrativos. Com um perfil
// escolhido, a região adequada é tracejada e os produtos dentro dela têm círculo cheio e os de
// fora círculo vazado, então a leitura não depende da cor. A tabela abaixo repete todos os valores.
export function RiskReturnScatterWidget(props: RiskReturnScatterWidgetProps) {
    const [selected, setSelected] = useState<ProductId>(props.highlight)
    const [profile, setProfile] = useState<ProfileChoice>(props.profile)

    const product = RISK_PRODUCTS.find((p) => p.id === selected) ?? RISK_PRODUCTS[0]
    const inside = profile === 'none' ? RISK_PRODUCTS : productsWithin(profile)
    const insideIds = new Set(inside.map((p) => p.id))
    const regionRight = profile === 'none' ? 0 : x(Math.min(PROFILE_MAX_VOLATILITY[profile], X_MAX))

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Perfil de investidor">
                {(['none', 'conservative', 'moderate', 'aggressive'] as ProfileChoice[]).map((choice) => (
                    <button
                        key={choice}
                        type="button"
                        className={styles.preset}
                        aria-pressed={profile === choice}
                        onClick={() => setProfile(choice)}
                    >
                        {choice === 'none' ? 'Sem perfil' : PROFILE_LABEL[choice]}
                    </button>
                ))}
            </div>
            <svg
                className={chart.chart}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label="Retorno esperado contra oscilação, por tipo de investimento"
            >
                {profile !== 'none' && (
                    <rect
                        className={chart.region}
                        x={PAD_L}
                        y={PAD_T}
                        width={Math.max(0, regionRight - PAD_L)}
                        height={HEIGHT - PAD_B - PAD_T}
                    />
                )}
                <line className={chart.axis} x1={PAD_L} y1={HEIGHT - PAD_B} x2={WIDTH - PAD_R} y2={HEIGHT - PAD_B} />
                <line className={chart.axis} x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={HEIGHT - PAD_B} />
                <text className={chart.axisLabel} x={WIDTH - PAD_R} y={HEIGHT - 6} textAnchor="end">
                    Oscilação ao ano (risco)
                </text>
                <text className={chart.axisLabel} x={4} y={PAD_T + 4}>
                    Retorno
                </text>
                {RISK_PRODUCTS.map((p) => (
                    <g key={p.id}>
                        <circle
                            cx={x(p.volatilityPct)}
                            cy={y(p.expectedReturnPct)}
                            r={p.id === selected ? 7 : 5}
                            className={`${insideIds.has(p.id) ? chart.pointIn : chart.pointOut} ${p.id === selected ? chart.selected : ''}`}
                        />
                        <text className={chart.label} x={x(p.volatilityPct) + 8} y={y(p.expectedReturnPct) + 3}>
                            {p.name}
                        </text>
                    </g>
                ))}
            </svg>
            <div className={styles.presets} role="group" aria-label="Investimento">
                {RISK_PRODUCTS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        className={styles.preset}
                        aria-pressed={selected === p.id}
                        onClick={() => setSelected(p.id)}
                    >
                        {p.name}
                    </button>
                ))}
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {product.name}: oscilação de {pct(product.volatilityPct)} e retorno esperado de {pct(product.expectedReturnPct)} ao ano.
                </p>
                <p>{product.note}</p>
                {profile !== 'none' && (
                    <p>
                        Perfil {PROFILE_LABEL[profile].toLowerCase()}: região até {pct(Math.min(PROFILE_MAX_VOLATILITY[profile], X_MAX))} de
                        oscilação (borda tracejada, círculo cheio dentro e vazado fora). {product.name} está{' '}
                        {insideIds.has(product.id) ? 'dentro' : 'fora'}.
                    </p>
                )}
                <p>Valores ilustrativos para mostrar a ideia. Retorno esperado não é garantido, e mais risco não assegura mais retorno.</p>
            </div>
        </div>
    )
}

export function riskReturnScatterSummary(_props: RiskReturnScatterWidgetProps): string {
    return `Gráfico de risco e retorno com ${RISK_PRODUCTS.length} investimentos (${RISK_PRODUCTS.map((p) => p.name).join(', ')}): a oscilação no eixo horizontal e o retorno esperado no vertical, com valores ilustrativos, e a região adequada a cada perfil de investidor.`
}
