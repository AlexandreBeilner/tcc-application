import { useCallback } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { reportFunnelEvent } from '../../../services/billing'
import type { FunnelEventInput } from '../../../services/billing'

// Passos já reportados nesta visita ao app. O servidor também limita a um por pessoa, evento,
// origem e dia; isto só poupa a chamada quando a tela é reaberta várias vezes seguidas.
const reported = new Set<string>()

// Só para os testes: cada teste começa sem nada reportado.
export function resetReportedFunnel(): void {
    reported.clear()
}

// Medição do funil de conversão (MO.7.1). Dispara e esquece: nunca bloqueia a tela nem mostra
// erro (medir é secundário), e sem sessão não faz nada. Não envia valor algum, só o passo e o
// ponto de convite.
export function useReportFunnel(): (input: FunnelEventInput) => void {
    const { token } = useAuth()

    return useCallback(
        (input) => {
            if (token === null) return
            const key = `${input.event}:${input.source ?? ''}`
            if (reported.has(key)) return
            reported.add(key)
            reportFunnelEvent(token, input).catch(() => {
                // Falhou: libera para tentar de novo na próxima vez que o passo acontecer.
                reported.delete(key)
            })
        },
        [token],
    )
}
