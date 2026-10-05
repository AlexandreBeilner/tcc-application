import type { FundBotInput } from '../../../services/admin'
import { MAX_INITIAL_CASH, parseNumber } from '../botForm'
import type { BotFundingErrors, BotFundingValues } from './types'

export type { BotFundingErrors, BotFundingValues } from './types'

// Espelha botadmin.MaxFundingQuantity: market_events.quantity é um inteiro de 32 bits.
export const MAX_FUNDING_QUANTITY = 2_000_000_000

export const EMPTY_FUNDING: BotFundingValues = { cash: '', assetId: '', quantity: '' }

export function validateFunding(values: BotFundingValues): BotFundingErrors {
    const errors: BotFundingErrors = {}
    const hasCash = values.cash.trim() !== ''
    const hasPosition = values.assetId !== '' || values.quantity.trim() !== ''

    if (!hasCash && !hasPosition) {
        errors.form = 'Informe um valor em caixa e/ou uma posição a aportar.'
        return errors
    }
    if (hasCash) {
        const cash = parseNumber(values.cash)
        if (!(cash > 0 && cash <= MAX_INITIAL_CASH)) errors.cash = 'Informe um valor maior que 0, de até R$ 1 trilhão.'
    }
    if (hasPosition) {
        if (values.assetId === '') errors.assetId = 'Escolha o ativo da posição.'
        const quantity = parseNumber(values.quantity)
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_FUNDING_QUANTITY) {
            errors.quantity = 'Use um número inteiro de cotas, maior que 0.'
        }
    }
    return errors
}

// Só chamar com `validateFunding` sem erros.
export function toFundInput(values: BotFundingValues): FundBotInput {
    const input: FundBotInput = {}
    if (values.cash.trim() !== '') input.cash = parseNumber(values.cash)
    if (values.assetId !== '') input.holdings = [{ asset_id: values.assetId, quantity: parseNumber(values.quantity) }]
    return input
}
