import type { BotFormValues } from '../../../features/admin/botForm'

export interface BotCreateFormProps {
    // Chamado só com valores já validados.
    onSubmit: (values: BotFormValues) => void
    pending: boolean
    // Recusa do motor ou falha da chamada, mostrada acima do botão.
    errorMessage?: string | null
}
