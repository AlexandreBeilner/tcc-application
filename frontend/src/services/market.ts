import { apiRequest } from './client'

// Espelha `.docs/backend/market.md` (`GET /market/me/account`) — única
// rota do módulo `market` que não é proxy 1:1, já em camelCase. Cada
// posição já vem com `type`/`isSandbox` (tarefa 6.0.3), insumo direto do
// donut de distribuição e da separação visual "Mercado Ao Vivo vs.
// Sandbox" da tela 2.1 (tarefa 6.3) — o agrupamento acontece aqui no
// frontend, a resposta não separa em dois blocos.
export interface MyAccountPosition {
    assetId: string
    ticker: string
    name: string
    type: string
    isSandbox: boolean
    quantity: number
    averagePrice: number
}

export interface MyAccountFixedIncomePosition extends MyAccountPosition {
    averageRate: number
}

export interface MyAccount {
    cashBalance: number
    totalInvested: number
    totalDividendsReceived: number
    positions: MyAccountPosition[]
    fixedIncomePositions: MyAccountFixedIncomePosition[]
}

export function getMyAccount(token: string): Promise<MyAccount> {
    return apiRequest<MyAccount>('/market/me/account', { token })
}
