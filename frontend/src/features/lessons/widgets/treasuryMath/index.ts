// Contas dos widgets de títulos públicos (RC.3.4d). Funções puras. A taxa de
// custódia espelha o fato `tesouro-custodia-b3` de
// `backend/src/modules/lessons/domain/regulatoryFacts.ts`; mudar lá exige mudar aqui.
import { irRatePctForDays } from '../fixedIncomeMath'
import { bondPrice, FACE_VALUE } from '../mtmMath'

export const CUSTODY_ANNUAL_PCT = 0.2

export interface BondPurchase {
    unitPrice: number
    discount: number
    discountPct: number
    quantity: number
    grossAtMaturity: number
    irRatePct: number
    ir: number
    custody: number
    netGain: number
    netAnnualPct: number
}

// Título prefixado sem cupom: paga o valor de face no vencimento e é vendido
// com deságio. O ganho bruto é a diferença; o líquido tira IR (tabela regressiva
// pelo prazo em dias corridos) e custódia da B3 (aproximada: taxa x anos x
// valor investido, sem acompanhar a variação diária do saldo).
export function bondPurchase(ratePct: number, years: number, amount: number): BondPurchase {
    const unitPrice = bondPrice(ratePct, years)
    const discount = FACE_VALUE - unitPrice
    const grossAtMaturity = amount * (FACE_VALUE / unitPrice)
    const grossGain = grossAtMaturity - amount
    const irRatePct = irRatePctForDays(Math.round(years * 365))
    const ir = grossGain * (irRatePct / 100)
    const custody = amount * (CUSTODY_ANNUAL_PCT / 100) * years
    const netGain = grossGain - ir - custody
    const netAnnualPct = amount > 0 ? ((1 + netGain / amount) ** (1 / years) - 1) * 100 : 0
    return {
        unitPrice,
        discount,
        discountPct: (discount / FACE_VALUE) * 100,
        quantity: unitPrice > 0 ? amount / unitPrice : 0,
        grossAtMaturity,
        irRatePct,
        ir,
        custody,
        netGain,
        netAnnualPct,
    }
}

export interface IpcaPlusYear {
    year: number
    principal: number
    inflation: number
    realInterest: number
    total: number
}

// Tesouro IPCA+ com inflação constante: o saldo cresce (1 + IPCA) x (1 + taxa
// real) por ano (Fisher), não IPCA + taxa. Cada ano separa principal, correção
// da inflação e juros reais acumulados.
export function ipcaPlusYears(amount: number, realRatePct: number, ipcaPct: number, years: number): IpcaPlusYear[] {
    return Array.from({ length: years }, (_, index) => {
        const year = index + 1
        const total = amount * ((1 + ipcaPct / 100) * (1 + realRatePct / 100)) ** year
        const inflation = amount * (1 + ipcaPct / 100) ** year - amount
        return { year, principal: amount, inflation, realInterest: total - amount - inflation, total }
    })
}

export interface IpcaPlusOutcome {
    gross: number
    ir: number
    net: number
    netAnnualPct: number
    realNetAnnualPct: number
}

// O IR incide sobre todo o ganho nominal, inclusive a parte que só repõe a
// inflação, então o rendimento real líquido fica abaixo da taxa real anunciada.
export function ipcaPlusOutcome(amount: number, realRatePct: number, ipcaPct: number, years: number): IpcaPlusOutcome {
    const gross = amount * ((1 + ipcaPct / 100) * (1 + realRatePct / 100)) ** years
    const ir = (gross - amount) * (irRatePctForDays(Math.round(years * 365)) / 100)
    const net = gross - ir
    const netAnnualPct = ((net / amount) ** (1 / years) - 1) * 100
    const realNetAnnualPct = ((1 + netAnnualPct / 100) / (1 + ipcaPct / 100) - 1) * 100
    return { gross, ir, net, netAnnualPct, realNetAnnualPct }
}

// Inflação de equilíbrio: a inflação que deixa prefixado e IPCA+ empatados,
// (1 + taxa prefixada) / (1 + taxa real) - 1.
export function breakevenInflationPct(prefixedPct: number, realPct: number): number {
    return ((1 + prefixedPct / 100) / (1 + realPct / 100) - 1) * 100
}

export type BreakevenWinner = 'prefixed' | 'ipca-plus' | 'tie'

export function breakevenWinner(expectedInflationPct: number, breakevenPct: number): BreakevenWinner {
    if (Math.abs(expectedInflationPct - breakevenPct) < 0.005) return 'tie'
    return expectedInflationPct > breakevenPct ? 'ipca-plus' : 'prefixed'
}
