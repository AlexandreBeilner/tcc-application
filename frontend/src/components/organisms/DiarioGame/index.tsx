import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../features/auth/AuthContext'
import { learnMoreDestination } from '../../../features/diario/destination'
import { DAILY_TODAY_QUERY_KEY } from '../../../features/diario/useDailyToday'
import { useLessonsQuery } from '../../../features/lessons/useLessonsQuery'
import { DiarioNextStep } from '../../molecules/DiarioNextStep'
import { createDailyApi, createServerKeeper, mountDiario } from '../../../features/diario'
import { useRewardReveal } from '../../../features/shell/RewardRevealProvider'
import { dispatchRewardReveals } from '../../../features/shell/dispatchRewardReveals'
import { MISSIONS_QUERY_KEY } from '../../../features/missions/useMissionsQuery'
import { API_BASE_URL } from '../../../services/client'
import { completeMission, listMissions } from '../../../services/missions'
import '../../../../../landing/src/diario/diario.css'

// Chave da missão "Jogue o Diário de hoje" (DI.6.1, ponto 060; `play_daily` no backend).
const PLAY_DAILY_MISSION_KEY = 'play_daily'

// Diário Selucra dentro do app (DI.4.1): o mesmo módulo sem framework da landing, em modo `app`.
// O estado vive no servidor (`/daily/:n/me`), então logado o jogo nunca usa `localStorage`; o token
// vai em cada chamada. Só o jogo do dia, concluído antes da virada, volta com `xpAwarded > 0`: nesse
// caso o teatro de recompensa roda uma vez (um dia anterior ou um reenvio fecha com 0 e não mostra nada).
// Conclui a missão do Diário logo depois do jogo (o servidor confere o jogo do dia). O reveal da missão
// entra na fila depois do do Diário. Falha, missão ausente ou já concluída: nada a mostrar, o jogo já valeu.
async function claimDailyMission(
    token: string | null,
    client: ReturnType<typeof useQueryClient>,
    reveal: Parameters<typeof dispatchRewardReveals>[0],
) {
    if (!token) return
    try {
        const { missions } = await listMissions(token)
        const mission = missions.find((m) => m.key === PLAY_DAILY_MISSION_KEY)
        if (!mission || mission.status === 'completed') return
        const result = await completeMission(token, mission.id)
        void client.invalidateQueries({ queryKey: MISSIONS_QUERY_KEY })
        void client.invalidateQueries({ queryKey: ['gamification'] })
        dispatchRewardReveals(reveal, result)
    } catch {
        // A missão é um bônus; quem joga não vê erro por ela.
    }
}

export function DiarioGame() {
    const { token, logout } = useAuth()
    const queryClient = useQueryClient()
    const { show } = useRewardReveal()
    const navigate = useNavigate()
    const lessons = useLessonsQuery().data?.lessons ?? []
    const [finished, setFinished] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    // O módulo é montado uma vez; o que muda entre renders entra por referência.
    const live = useRef({ token, logout, queryClient, show, navigate, lessons })

    useEffect(() => {
        live.current = { token, logout, queryClient, show, navigate, lessons }
    })

    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        // Jogo já fechado reaberto: o módulo só redesenha o resultado (sem `onComplete`), então o painel de
        // resultado preenchido também vale como "terminou".
        const watcher = new MutationObserver(() => {
            if (root.querySelector('.dg-result')?.childElementCount) setFinished(true)
        })
        watcher.observe(root, { childList: true, subtree: true })
        // Os links do módulo são `<a href>` comuns; dentro do app navegam pelo roteador, sem recarregar.
        const onClick = (event: MouseEvent) => {
            const link = (event.target as Element | null)?.closest?.('a[href^="/"]')
            if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
            event.preventDefault()
            live.current.navigate(link.getAttribute('href') as string)
        }
        root.addEventListener('click', onClick)
        const api = createDailyApi({ baseUrl: API_BASE_URL, getToken: () => live.current.token })
        const controller = mountDiario(root, {
            api,
            mode: 'app',
            keeper: createServerKeeper(api),
            learnMoreHref: (learnMore) => learnMoreDestination(learnMore, live.current.lessons),
            onUnauthorized: () => live.current.logout(),
            onComplete: ({ completion }) => {
                setFinished(true)
                void live.current.queryClient.invalidateQueries({ queryKey: DAILY_TODAY_QUERY_KEY })
                if (!completion || completion.xpAwarded <= 0) return
                const { queryClient: client, show: reveal } = live.current
                void client.invalidateQueries({ queryKey: ['gamification'] })
                dispatchRewardReveals(reveal, {
                    xpAwarded: completion.xpAwarded,
                    leveledUp: completion.leveledUp,
                    newLevel: completion.level,
                    streakMilestone: completion.streakMilestone,
                    unlockedAchievements: completion.unlockedAchievements,
                })
                void claimDailyMission(live.current.token, client, reveal)
            },
        })
        return () => {
            watcher.disconnect()
            root.removeEventListener('click', onClick)
            controller.destroy()
        }
    }, [])

    return (
        <>
            <div ref={rootRef} />
            {finished && <DiarioNextStep lessons={lessons} />}
        </>
    )
}
