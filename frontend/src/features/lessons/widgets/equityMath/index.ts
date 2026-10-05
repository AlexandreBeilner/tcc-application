// Contas dos widgets de ações da abertura da Trilha 2 (RC.3.4e). Funções puras.

export interface Ownership {
    ownershipPct: number
    marketCap: number
    yourValue: number
    dividend: number
}

// Participação do acionista: ações dele sobre o total. O valor da fatia é preço
// x ações, e o dividendo é a parte dele no que a empresa decide distribuir
// (lucro x percentual distribuído), nunca no lucro inteiro.
export function ownership(price: number, totalShares: number, yourShares: number, profit: number, payoutPct: number): Ownership {
    const share = totalShares > 0 ? yourShares / totalShares : 0
    return {
        ownershipPct: share * 100,
        marketCap: price * totalShares,
        yourValue: price * yourShares,
        dividend: profit * (payoutPct / 100) * share,
    }
}

export interface BookbuildingOrder {
    investor: string
    qty: number
    maxPriceCents: number
}

export const BOOKBUILDING_ORDERS: BookbuildingOrder[] = [
    { investor: 'Fundo A', qty: 300_000, maxPriceCents: 2200 },
    { investor: 'Fundo B', qty: 250_000, maxPriceCents: 2100 },
    { investor: 'Fundo C', qty: 200_000, maxPriceCents: 2050 },
    { investor: 'Gestora D', qty: 250_000, maxPriceCents: 2000 },
    { investor: 'Previdência E', qty: 200_000, maxPriceCents: 1950 },
    { investor: 'Fundo F', qty: 300_000, maxPriceCents: 1900 },
    { investor: 'Gestora G', qty: 150_000, maxPriceCents: 1850 },
    { investor: 'Pessoas físicas', qty: 200_000, maxPriceCents: 1800 },
]

export interface DemandLevel {
    priceCents: number
    cumulativeQty: number
}

// Demanda acumulada: em cada preço, quanto investidores aceitam comprar (os que
// têm preço máximo igual ou acima dele), do maior preço para o menor.
export function demandCurve(orders: BookbuildingOrder[]): DemandLevel[] {
    const prices = [...new Set(orders.map((o) => o.maxPriceCents))].sort((a, b) => b - a)
    return prices.map((priceCents) => ({
        priceCents,
        cumulativeQty: orders.filter((o) => o.maxPriceCents >= priceCents).reduce((sum, o) => sum + o.qty, 0),
    }))
}

export interface BookbuildingResult {
    cutCents: number | null
    coverage: number
    primaryShares: number
    secondaryShares: number
    companyCash: number
    sellersCash: number
    marketCap: number
    dilutionPct: number
}

// Preço de corte: o maior preço em que a demanda acumulada cobre a oferta.
// Sem preço que cubra, a oferta não fecha. Caixa da empresa vem só da parte
// primária (ações novas); a secundária paga os sócios que vendem.
export function bookbuilding(
    orders: BookbuildingOrder[],
    offeredShares: number,
    primaryPct: number,
    existingShares: number,
): BookbuildingResult {
    const curve = demandCurve(orders)
    const level = curve.find((l) => l.cumulativeQty >= offeredShares) ?? null
    const primaryShares = Math.round(offeredShares * (primaryPct / 100))
    const secondaryShares = offeredShares - primaryShares
    if (!level) {
        return { cutCents: null, coverage: 0, primaryShares, secondaryShares, companyCash: 0, sellersCash: 0, marketCap: 0, dilutionPct: 0 }
    }
    const cut = level.priceCents / 100
    const total = existingShares + primaryShares
    return {
        cutCents: level.priceCents,
        coverage: level.cumulativeQty / offeredShares,
        primaryShares,
        secondaryShares,
        companyCash: primaryShares * cut,
        sellersCash: secondaryShares * cut,
        marketCap: total * cut,
        dilutionPct: total > 0 ? (primaryShares / total) * 100 : 0,
    }
}
