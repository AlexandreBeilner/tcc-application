import { positionCurrentValue } from '../positionValue'
import type { AccountTotals, PositionLike } from './types'

export type { AccountTotals } from './types'

// `GET /market/me/account` (6.0.3) não separa saldo/total investido por
// sandbox — "não têm equivalente sandbox: é a mesma conta, só os ativos
// negociados têm a flag" (`.docs/backend/market.md`). Os dois cards da
// tela 2.1 ("Mercado Ao Vivo vs. Sandbox") se resolvem agrupando as
// posições por `isSandbox` aqui; `cashBalance`, por não ter equivalente
// sandbox, só aparece no card de mercado ao vivo.
//
// `liveInvested` usa `markPrice` (tarefa S.6, ponto médio do book com
// fallback pro último negócio) quando presente — patrimônio marcado a
// mercado, não a custo. `markPrice` só vem preenchido pra posição real de
// renda variável (nunca sandbox, nem renda fixa); nesses casos cai pro
// preço médio de aquisição (custo), mesmo comportamento de antes da S.6.
export function calculateAccountTotals(positions: PositionLike[], fixedIncomePositions: PositionLike[]): AccountTotals {
    let liveInvested = 0
    let sandboxInvested = 0

    for (const position of [...positions, ...fixedIncomePositions]) {
        const value = positionCurrentValue(position)
        if (position.isSandbox) {
            sandboxInvested += value
        } else {
            liveInvested += value
        }
    }

    return { liveInvested, sandboxInvested }
}
