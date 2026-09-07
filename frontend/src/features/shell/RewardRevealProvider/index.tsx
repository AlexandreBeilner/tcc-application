import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { RewardReveal } from '../../../components/organisms/RewardReveal'
import type { RewardRevealContent, RewardRevealContextValue } from './types'

export type { RewardRevealContent, RewardRevealContextValue } from './types'

interface QueuedReveal extends RewardRevealContent {
    id: number
}

const RewardRevealContext = createContext<RewardRevealContextValue | undefined>(undefined)

// Contexto leve novo (tarefa I.1) — não entra em `store/`, reservado até
// haver caso de uso real de lib de estado global (CLAUDE.md). Fila simples:
// um reveal por vez, o próximo só monta depois que o atual fecha (I.3-I.5
// vão poder chamar `show()` várias vezes seguidas quando XP, level-up,
// conquista e streak baterem juntos na mesma resposta).
export function RewardRevealProvider({ children }: { children: ReactNode }) {
    const [queue, setQueue] = useState<QueuedReveal[]>([])
    const nextIdRef = useRef(0)

    const show = useCallback((content: RewardRevealContent) => {
        // `id` calculado aqui, fora do updater: um updater de `setQueue` só
        // pode ler `current` (o parâmetro) e o que fechou por valor no
        // momento da chamada — ler `nextIdRef.current` *dentro* do updater
        // seria impuro (React pode invocar o updater mais de uma vez, ex:
        // StrictMode em dev, ou reprocessar a fila num único batch quando
        // `show()` é chamado 2x seguidas) e todo item acabaria com o mesmo
        // id, a fila colapsando pra 1 item visível em vez de 2 na fila.
        nextIdRef.current += 1
        const id = nextIdRef.current
        setQueue((current) => [...current, { ...content, id }])
    }, [])

    const dismissCurrent = useCallback(() => {
        setQueue((current) => current.slice(1))
    }, [])

    const value = useMemo(() => ({ show }), [show])
    const current = queue[0]

    return (
        <RewardRevealContext.Provider value={value}>
            {children}
            {/* `key` força remontar a cada item novo da fila: reinicia a
                animação de entrada e o timer de auto-fechamento, em vez de só
                re-renderizar o mesmo <RewardReveal> com props novas. */}
            {current && (
                <RewardReveal
                    key={current.id}
                    icon={current.icon}
                    title={current.title}
                    description={current.description}
                    onDismiss={dismissCurrent}
                />
            )}
        </RewardRevealContext.Provider>
    )
}

export function useRewardReveal(): RewardRevealContextValue {
    const ctx = useContext(RewardRevealContext)
    if (!ctx) {
        throw new Error('useRewardReveal precisa ser usado dentro de <RewardRevealProvider>')
    }
    return ctx
}
