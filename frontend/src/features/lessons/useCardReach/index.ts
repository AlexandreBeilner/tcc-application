import { useEffect, useRef } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { recordCardReach } from '../../../services/lessons'

// Mesmo teto do servidor (`MAX_CARD_INDEX`): acima disso o POST seria recusado.
const MAX_CARD_INDEX = 59

export interface CardPosition {
    phase: number
    card: number
}

// O cartão está além do último já reportado nesta sessão (fase primeiro, depois cartão). Voltar a um
// cartão anterior e avançar de novo não repete o POST; o servidor também ignora, mas poupa a chamada.
export function isBeyondReported(reported: CardPosition | null, position: CardPosition): boolean {
    if (position.card > MAX_CARD_INDEX) return false
    if (reported === null) return true
    return position.phase > reported.phase || (position.phase === reported.phase && position.card > reported.card)
}

// Funil por cartão (LJ.5.1): avisa o servidor a cada cartão novo que o player mostra. Fire-and-forget
// (uma falha de rede nunca atrapalha a lição) e desligado em revisão, onde nada é medido.
export function useCardReach(lessonId: string, position: CardPosition, enabled: boolean): void {
    const { token } = useAuth()
    const reported = useRef<CardPosition | null>(null)
    const { phase, card } = position

    useEffect(() => {
        if (!enabled || token === null) return
        const current = { phase, card }
        if (!isBeyondReported(reported.current, current)) return
        reported.current = current
        recordCardReach(token, lessonId, phase, card).catch(() => {})
    }, [enabled, token, lessonId, phase, card])
}
