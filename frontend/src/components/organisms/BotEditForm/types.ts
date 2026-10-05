import type { BotEditErrors, BotEditValues } from '../../../features/admin/botEdit'
import type { BotArchetype } from '../../../services/admin'

export interface BotEditFormProps {
    archetype: BotArchetype
    values: BotEditValues
    onChange: (values: BotEditValues) => void
    errors: BotEditErrors
}
