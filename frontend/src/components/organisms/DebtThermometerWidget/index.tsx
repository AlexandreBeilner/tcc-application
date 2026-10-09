import { useState } from 'react'
import {
    DEBT_ZONE_LIMITS,
    debtReading,
    formatMillions,
    formatRatio,
    shockedFinancialExpense,
} from '../../../features/lessons/widgets/companyMath'
import type { DebtZone } from '../../../features/lessons/widgets/companyMath'
import type { DebtThermometerWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { DebtThermometerWidgetProps } from './types'

const ZONE_TEXT: Record<DebtZone, string> = {
    low: 'Folgado: a dívida líquida cabe em poucos anos de EBIT.',
    attention: 'Atenção: a dívida líquida já pede vários anos de EBIT.',
    pressure: 'Pesado: a dívida líquida passa de quatro anos de EBIT.',
    none: 'Sem EBIT positivo, esta leitura não se aplica.',
}

const SHOCK_POINTS = 3

// Widget `debt-thermometer` (RC.3.4f): dívida líquida (dívida bruta menos caixa),
// quantas vezes ela cabe no EBIT, e a cobertura dos juros (EBIT sobre despesa
// financeira). O botão de choque sobe a Selic em 3 pontos: a parte da dívida
// atrelada ao CDI fica mais cara e a cobertura cai. As faixas são didáticas.
// Vale para empresas comuns, não para bancos, onde a dívida é a matéria-prima.
export function DebtThermometerWidget(props: DebtThermometerWidgetProps) {
    const [grossDebt, setGrossDebt] = useState(props.grossDebt)
    const [cash, setCash] = useState(props.cash)
    const [cdiShare, setCdiShare] = useState(props.cdiSharePct)
    const [shocked, setShocked] = useState(false)

    const expense = shocked ? shockedFinancialExpense(props.financialExpense, grossDebt, cdiShare, SHOCK_POINTS) : props.financialExpense
    const reading = debtReading(grossDebt, cash, props.ebit, expense)
    const fill = reading.netDebtToEbit === null ? 0 : Math.min(100, Math.max(0, (reading.netDebtToEbit / 6) * 100))

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Dívida bruta: {formatMillions(grossDebt)}
                    <input
                        type="range"
                        min={0}
                        max={2000}
                        step={50}
                        value={grossDebt}
                        onChange={(e) => setGrossDebt(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Caixa: {formatMillions(cash)}
                    <input type="range" min={0} max={1500} step={50} value={cash} onChange={(e) => setCash(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Dívida atrelada ao CDI: {cdiShare}%
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={10}
                        value={cdiShare}
                        onChange={(e) => setCdiShare(Number(e.target.value))}
                    />
                </label>
            </div>
            <div className={styles.presets} role="group" aria-label="Cenário de juros">
                <button type="button" className={styles.preset} aria-pressed={!shocked} onClick={() => setShocked(false)}>
                    Selic como está
                </button>
                <button type="button" className={styles.preset} aria-pressed={shocked} onClick={() => setShocked(true)}>
                    E se a Selic subir {SHOCK_POINTS} pontos?
                </button>
            </div>
            <span className={styles.barTrack} role="img" aria-label={`Dívida líquida em ${formatRatio(reading.netDebtToEbit)} o EBIT`}>
                <span className={styles.barFill} style={{ width: `${fill}%` }} />
            </span>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Dívida líquida de {formatMillions(reading.netDebt)}, ou {formatRatio(reading.netDebtToEbit)} o EBIT de{' '}
                    {formatMillions(props.ebit)}.
                </p>
                <p>{ZONE_TEXT[reading.zone]}</p>
                {reading.netDebt < 0 && <p>Dívida líquida negativa: a empresa tem mais caixa do que dívida.</p>}
                <p>
                    Despesa financeira de {formatMillions(expense)}. Cobertura de juros de {formatRatio(reading.coverage)}: o EBIT paga os
                    juros essas vezes.
                </p>
                <p>
                    Faixas didáticas: até {DEBT_ZONE_LIMITS.attention}x folgado e acima de {DEBT_ZONE_LIMITS.pressure}x pesado. Este
                    indicador não vale para bancos, porque neles a dívida é a matéria-prima do negócio.
                </p>
            </div>
        </div>
    )
}

export function debtThermometerSummary({ grossDebt, cash, ebit }: DebtThermometerWidgetProps): string {
    return `Termômetro de endividamento: com dívida bruta de ${formatMillions(grossDebt)}, caixa de ${formatMillions(cash)} e EBIT de ${formatMillions(ebit)}, mostra a dívida líquida, quantas vezes ela cabe no EBIT, a cobertura dos juros e o efeito de uma alta de 3 pontos na Selic sobre a dívida atrelada ao CDI.`
}
