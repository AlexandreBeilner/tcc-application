import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../features/auth/AuthContext'
import { createDailyApi, createServerKeeper, mountDiario } from '../../../features/diario'
import { useRewardReveal } from '../../../features/shell/RewardRevealProvider'
import { dispatchRewardReveals } from '../../../features/shell/dispatchRewardReveals'
import { API_BASE_URL } from '../../../services/client'
import '../../../../../landing/src/diario/diario.css'

// Diário Selucra dentro do app (DI.4.1): o mesmo módulo sem framework da landing, em modo `app`.
// O estado vive no servidor (`/daily/:n/me`), então logado o jogo nunca usa `localStorage`; o token
// vai em cada chamada. Só o jogo do dia, concluído antes da virada, volta com `xpAwarded > 0`: nesse
// caso o teatro de recompensa roda uma vez (um dia anterior ou um reenvio fecha com 0 e não mostra nada).
export function DiarioGame() {
    const { token, logout } = useAuth()
    const queryClient = useQueryClient()
    const { show } = useRewardReveal()
    const rootRef = useRef<HTMLDivElement>(null)
    // O módulo é montado uma vez; o que muda entre renders entra por referência.
    const live = useRef({ token, logout, queryClient, show })

    useEffect(() => {
        live.current = { token, logout, queryClient, show }
    })

    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        const api = createDailyApi({ baseUrl: API_BASE_URL, getToken: () => live.current.token })
        const controller = mountDiario(root, {
            api,
            mode: 'app',
            keeper: createServerKeeper(api),
            onUnauthorized: () => live.current.logout(),
            onComplete: ({ completion }) => {
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
            },
        })
        return () => controller.destroy()
    }, [])

    return <div ref={rootRef} />
}
