import type { ReactNode } from 'react'
import type { ProInviteContext } from '../../../features/billing/proInviteDismissal'

export interface ProInviteProps {
    context: ProInviteContext
    // Título opcional: quando o convite substitui uma seção inteira (ex: criar liga), ele leva o
    // título da seção, para a seção não sobrar vazia depois de dispensado.
    title?: string
    // Mensagem do convite. Nunca com culpa nem escassez (proposta-engajamento-licoes.md).
    children: ReactNode
}
