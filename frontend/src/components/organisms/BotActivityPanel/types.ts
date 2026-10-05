import type { BotActivity } from '../../../services/admin'

export interface BotActivityPanelProps {
    activity: BotActivity | undefined
    isLoading: boolean
    isError: boolean
    // Janela em dias simulados.
    days: number
    onDaysChange: (days: number) => void
}
