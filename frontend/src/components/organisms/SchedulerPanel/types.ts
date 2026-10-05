import type { SchedulerStatus } from '../../../services/admin'

export interface SchedulerPanelProps {
    status: SchedulerStatus
    // Qualquer ação em andamento trava todos os botões (o motor só roda um tick por vez).
    busy: boolean
    onTogglePause: () => void
    onTriggerTick: () => void
    onAdvance: (days: number) => void
}
