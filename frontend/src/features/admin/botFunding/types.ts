// Valores do formulário de aporte como texto digitado (N.15): caixa em R$ e, opcionalmente, uma
// posição (ativo e quantidade). Os dois são opcionais, mas pelo menos um é obrigatório.
export interface BotFundingValues {
    cash: string
    assetId: string
    quantity: string
}

export type BotFundingErrors = Partial<Record<keyof BotFundingValues | 'form', string>>
