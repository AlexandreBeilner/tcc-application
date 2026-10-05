import type { ReactNode } from 'react'
import type { AdminBot } from '../../../services/admin'

export interface AdminBotsTableProps {
    bots: AdminBot[]
    // Id do bot cuja mutação está em andamento, pra travar só os botões dele.
    updatingId: string | null
    onToggle: (bot: AdminBot) => void
    // Só o Market Maker tem cobertura pra editar.
    onEditCoverage: (bot: AdminBot) => void
    // Edição da personalidade e aporte de caixa ou posição (N.15).
    onEdit: (bot: AdminBot) => void
    onFund: (bot: AdminBot) => void
    emptyMessage: string
    // Bot com o desempenho aberto (N.14); o detalhe aparece logo abaixo da linha ou do cartão dele.
    expandedId: string | null
    onToggleActivity: (bot: AdminBot) => void
    renderDetail: (bot: AdminBot) => ReactNode
}
