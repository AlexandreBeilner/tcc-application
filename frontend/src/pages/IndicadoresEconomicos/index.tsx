import { useState } from 'react'
import { IndicatorSummaryCards } from '../../components/organisms/IndicatorSummaryCards'
import { IndicatorLineChart } from '../../components/organisms/IndicatorLineChart'
import { useIndicatorHistoryQuery } from '../../features/market/useIndicatorHistoryQuery'
import { nextCopomSimulatedDay } from '../../features/market/nextCopomDay'
import { formatPercentage } from '../../features/portfolio/format'
import { formatRatePercent } from '../../features/market/format'
import styles from './index.module.css'

const RANGES = [
    { days: 90, label: '3M' },
    { days: 180, label: '6M' },
    { days: 365, label: '1A' },
]

// Tela 4.9 (inventário) — tarefa M.4. Fonte de dado única
// (`GET /market/indicators`, tarefa M.3): a mesma série alimenta os cards
// de valor corrente (último item, mais recente por vir em ordem
// cronológica) e os dois gráficos históricos. "Próximo Copom simulado" não
// vem de nenhum endpoint — é derivado no cliente a partir do último
// `simulated_day` conhecido (`nextCopomSimulatedDay`, mesma cadência fixa
// de `selic.CopomMeetingIntervalDays` no motor), já que o motor só marca o
// dia em que uma reunião JÁ aconteceu, nunca a próxima.
export function IndicadoresEconomicos() {
    const [rangeDays, setRangeDays] = useState(RANGES[0].days)
    const query = useIndicatorHistoryQuery(rangeDays)

    if (query.isError) {
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    Não foi possível carregar os indicadores agora. Tente novamente em instantes.
                </p>
            </main>
        )
    }

    if (!query.data) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando indicadores…</p>
            </main>
        )
    }

    const indicators = query.data.indicators
    const latest = indicators[indicators.length - 1]

    const selicEntries = indicators.map((entry) => ({ simulatedDay: entry.simulated_day, value: entry.selic_rate }))
    const ipcaEntries = indicators.map((entry) => ({ simulatedDay: entry.simulated_day, value: entry.ipca_accumulated_12m }))

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Indicadores Econômicos</h1>
                <p className={styles.subtitle}>
                    Selic e IPCA simulados — os dois indicadores por trás do rendimento e do preço dos ativos.
                </p>
            </header>

            <IndicatorSummaryCards latest={latest} nextCopomSimulatedDay={nextCopomSimulatedDay(latest?.simulated_day ?? 0)} />

            <div className={styles.charts}>
                <IndicatorLineChart
                    title="Selic (meta anual)"
                    entries={selicEntries}
                    ranges={RANGES}
                    activeDays={rangeDays}
                    onRangeChange={setRangeDays}
                    formatValue={formatRatePercent}
                />

                <IndicatorLineChart
                    title="IPCA acumulado 12m"
                    entries={ipcaEntries}
                    ranges={RANGES}
                    activeDays={rangeDays}
                    onRangeChange={setRangeDays}
                    formatValue={formatPercentage}
                />
            </div>
        </main>
    )
}
