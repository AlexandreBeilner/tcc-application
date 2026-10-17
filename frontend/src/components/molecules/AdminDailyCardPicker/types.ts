import type { DailyReplaceCardInput } from '../../../services/admin'

export type PickerCard = 'word' | 'question' | 'timeline'

export interface AdminDailyCardPickerProps {
    card: PickerCard
    // Ids hoje no jogo (o item atual não aparece como opção de troca).
    currentIds: string[]
    // O jogo já está publicado: a troca pede confirmação explícita.
    published: boolean
    pending: boolean
    error: string | null
    onSubmit: (input: DailyReplaceCardInput) => void
    onCancel: () => void
}
