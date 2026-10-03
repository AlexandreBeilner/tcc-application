import type { AdminBot } from '../../../services/admin'

export interface AdminBotsTableProps {
    bots: AdminBot[]
    // Id do bot cuja mutação está em andamento, pra travar só os botões dele.
    updatingId: string | null
    onToggle: (bot: AdminBot) => void
    // Só o Market Maker tem cobertura pra editar.
    onEditCoverage: (bot: AdminBot) => void
    emptyMessage: string
}
