import type { AssetCategory } from '../distribution/types'

export interface ReturnPositionInput {
    assetId: string
    ticker: string
    name: string
    type: string
    isSandbox: boolean
    quantity: number
    averagePrice: number
    /** Renda variável: preço de marcação a mercado. */
    markPrice?: number
    /** Renda variável: proventos recebidos neste ativo (R$). */
    dividendsReceived?: number
    /** Renda fixa: valor bruto de hoje e líquido de IR (MO.8.1). */
    currentValue?: number
    netValue?: number
}

export interface PositionReturn {
    assetId: string
    ticker: string
    name: string
    type: string
    category: AssetCategory | null
    isSandbox: boolean
    isFixedIncome: boolean
    quantity: number
    averagePrice: number
    /** Valor aplicado: quantidade × preço médio. */
    cost: number
    /** Renda variável: marcação a mercado; renda fixa: valor bruto avaliado, ou o custo se não houve avaliação. */
    currentValue: number
    /** Renda fixa sem avaliação do motor: `currentValue` é só o custo e a tela mostra "sem avaliação agora". */
    valued: boolean
    resultAmount: number
    /** Razão (0,05 = 5%); `null` quando o custo é zero. */
    resultRatio: number | null
    dividendsReceived: number
    /** Resultado somado aos proventos. */
    totalResultAmount: number
    totalResultRatio: number | null
    /** Renda fixa: líquido de IR se resgatasse hoje (informação secundária). */
    netValue?: number
    /** Fatia do valor atual dentro do próprio grupo (Mercado Ao Vivo ou Sandbox), de 0 a 1. */
    weight: number
}

export interface PortfolioSummary {
    cost: number
    currentValue: number
    resultAmount: number
    resultRatio: number | null
    dividendsReceived: number
    totalResultAmount: number
    totalResultRatio: number | null
}

export interface PortfolioReturns {
    live: PositionReturn[]
    sandbox: PositionReturn[]
    liveSummary: PortfolioSummary
    sandboxSummary: PortfolioSummary
}

export interface EquityReturn {
    currentPrice: number
    priceReturn: number | null
    totalReturn: number | null
}
