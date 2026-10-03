import type { LucideIcon } from 'lucide-react'

export interface AdminSection {
    key: string
    label: string
    Icon: LucideIcon
    // Rota da seção; `undefined` enquanto a tela da tarefa correspondente não
    // existe (a seção aparece desabilitada com "Em breve").
    to?: string
    // Só a Visão geral (`/admin`) usa `end`, senão ficaria ativa em toda sub-rota.
    end?: boolean
    // Tarefa do backlog que entrega a seção (mostrada na dica de "Em breve").
    task: string
}
