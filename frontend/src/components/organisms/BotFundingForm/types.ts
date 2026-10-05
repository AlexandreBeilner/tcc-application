import type { SelectOption } from '../../atoms/Select'
import type { BotFundingErrors, BotFundingValues } from '../../../features/admin/botFunding'

export interface BotFundingFormProps {
    values: BotFundingValues
    onChange: (values: BotFundingValues) => void
    errors: BotFundingErrors
    // Ativos negociáveis pra escolher a posição (o primeiro item é "sem posição").
    assetOptions: SelectOption[]
    // Caixa atual do bot, só informativo.
    currentCash: number
}
