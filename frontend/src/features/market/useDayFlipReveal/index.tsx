import { useEffect, useRef, useState } from 'react'
import { HandCoins, Zap } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useRewardReveal } from '../../shell/RewardRevealProvider'
import { getIndicatorHistory, getMarketCalendar } from '../../../services/market'
import type { CalendarEvent, MarketClock } from '../../../services/market'
import { describeDayFlip, describeSalaryReveal } from '../dayFlipReveal'

const FLIP_ANIMATION_MS = 800

// Teatro de recompensa leve da virada de dia (S.12): quando `simulated_day`
// muda entre duas leituras do relógio, o ponteiro gira (`flipping`) e um toast
// dourado avisa "Novo dia: Selic X%". A primeira leitura nunca conta como virada.
// A Selic vem do último ponto de `/market/indicators`; se falhar, o toast cai
// no número do dia em vez de sumir. Se o novo dia também pagou salário
// (tarefa T.7), um toast dedicado por crédito entra na mesma fila do
// RewardRevealProvider, sem substituir o de virada de dia — normalmente só
// um, mas um catch-up de meses atrasados (backend T.5, achado 025) credita
// mais de um salary_payment no mesmo dia, então mais de um toast pode entrar
// na fila, cada um nomeando o mês a que se refere.
export function useDayFlipReveal(clock: MarketClock | undefined): boolean {
    const { token } = useAuth()
    const { show } = useRewardReveal()
    const previousDay = useRef<number | null>(null)
    const [flipping, setFlipping] = useState(false)

    const simulatedDay = clock?.simulated_day
    useEffect(() => {
        if (!clock || simulatedDay === undefined) return
        const previous = previousDay.current
        previousDay.current = simulatedDay
        if (previous === null || previous === simulatedDay) return

        let cancelled = false
        setFlipping(true)
        const stop = setTimeout(() => setFlipping(false), FLIP_ANIMATION_MS)

        void (async () => {
            let selic: number | null = null
            try {
                const { indicators } = await getIndicatorHistory(token as string, 1)
                const latest = indicators.reduce<(typeof indicators)[number] | null>(
                    (best, entry) => (best === null || entry.simulated_day > best.simulated_day ? entry : best),
                    null,
                )
                selic = latest?.selic_rate ?? null
            } catch {
                selic = null
            }
            if (cancelled) return
            const content = describeDayFlip(clock, selic)
            show({ icon: <Zap size={22} strokeWidth={2.2} fill="currentColor" />, ...content })

            let salariesPaid: CalendarEvent[] = []
            try {
                const { days } = await getMarketCalendar(token as string, clock.date, clock.date)
                salariesPaid = (days[0]?.events ?? []).filter((e) => e.kind === 'salary_payment' && e.scope === 'user' && !e.future)
            } catch {
                salariesPaid = []
            }
            if (cancelled) return
            // Catch-up de vários meses atrasados (backend, T.5, achado 025) credita
            // mais de um salary_payment no mesmo dia — um toast por crédito, cada
            // um nomeando o mês quando há mais de um (senão saem idênticos).
            for (const paid of salariesPaid) {
                if (paid.unit_value === undefined) continue
                const referenceMonth = salariesPaid.length > 1 ? paid.reference_month : undefined
                show({ icon: <HandCoins size={22} strokeWidth={2.2} />, ...describeSalaryReveal(paid.unit_value, referenceMonth) })
            }
        })()

        return () => {
            cancelled = true
            clearTimeout(stop)
        }
        // `clock` inteiro fora das deps de propósito: só a virada de dia dispara.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simulatedDay])

    return flipping
}
