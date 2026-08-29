interface PositionLike {
    isSandbox: boolean
    quantity: number
    averagePrice: number
}

export interface AccountTotals {
    liveInvested: number
    sandboxInvested: number
}

// `GET /market/me/account` (6.0.3) não separa saldo/total investido por
// sandbox — "não têm equivalente sandbox: é a mesma conta, só os ativos
// negociados têm a flag" (`.docs/backend/market.md`). Os dois cards da
// tela 2.1 ("Mercado Ao Vivo vs. Sandbox") se resolvem agrupando as
// posições por `isSandbox` aqui; `cashBalance`, por não ter equivalente
// sandbox, só aparece no card de mercado ao vivo.
export function calculateAccountTotals(positions: PositionLike[], fixedIncomePositions: PositionLike[]): AccountTotals {
    let liveInvested = 0
    let sandboxInvested = 0

    for (const position of [...positions, ...fixedIncomePositions]) {
        const value = position.quantity * position.averagePrice
        if (position.isSandbox) {
            sandboxInvested += value
        } else {
            liveInvested += value
        }
    }

    return { liveInvested, sandboxInvested }
}
