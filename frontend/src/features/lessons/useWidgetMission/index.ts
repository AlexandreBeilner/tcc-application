import { useCallback, useEffect, useRef, useState } from 'react'
import { SHOW_ME_AFTER_INTERACTIONS, SHOW_ME_AFTER_MS, goalMet } from '../widgets/goal'
import type { WidgetGoal, WidgetMetrics } from '../widgets/goal'

// Como a missão terminou: sozinha (vale como acerto de primeira) ou pelo "Me mostra" (conta como não de primeira).
export type MissionOutcome = 'first-try' | 'later'

interface Options {
    goal: WidgetGoal | undefined
    outcome: MissionOutcome | undefined
    onComplete: (outcome: MissionOutcome) => void
}

// Estado de uma missão de widget (LJ.3.1, decisão LJ-D4). O widget informa as métricas (`onMetrics`) e o contêiner
// informa cada interação (`onInteraction`); a missão só vale depois de ao menos uma interação, para um widget que já
// nasce no alvo não contar de graça. "Me mostra" aparece com 2 minutos mexendo sem atingir ou 6 interações.
export function useWidgetMission({ goal, outcome, onComplete }: Options) {
    const [showMeReady, setShowMeReady] = useState(false)
    // Cada "Me mostra" remonta o widget com os valores-alvo como ponto de partida.
    const [showMeRound, setShowMeRound] = useState(0)
    const interactions = useRef(0)
    // Evita contar duas vezes a mesma missão (o "Me mostra" remonta o widget, que informa métricas de novo).
    const completed = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const clearTimer = useCallback(() => {
        if (timer.current !== undefined) clearTimeout(timer.current)
        timer.current = undefined
    }, [])
    useEffect(() => clearTimer, [clearTimer])

    const onMetrics = useCallback(
        (metrics: WidgetMetrics) => {
            if (!goal || outcome || completed.current || interactions.current === 0 || !goalMet(goal, metrics)) return
            completed.current = true
            clearTimer()
            setShowMeReady(false)
            onComplete('first-try')
        },
        [goal, outcome, onComplete, clearTimer],
    )

    const onInteraction = useCallback(() => {
        if (!goal || outcome) return
        interactions.current += 1
        if (timer.current === undefined) {
            timer.current = setTimeout(() => setShowMeReady(true), SHOW_ME_AFTER_MS)
        }
        if (interactions.current >= SHOW_ME_AFTER_INTERACTIONS) setShowMeReady(true)
    }, [goal, outcome])

    const showMe = useCallback(() => {
        completed.current = true
        clearTimer()
        setShowMeReady(false)
        setShowMeRound((round) => round + 1)
        onComplete('later')
    }, [clearTimer, onComplete])

    return { onMetrics, onInteraction, showMe, showMeRound, showMeReady: showMeReady && !outcome }
}
