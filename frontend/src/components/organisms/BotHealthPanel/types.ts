import type { BotsSummary } from '../../../services/admin'

export interface BotHealthPanelProps {
    summary: BotsSummary
    // Abre o desempenho do bot na lista (os ids do resumo são os mesmos da lista).
    onOpenActivity: (botId: string) => void
}
