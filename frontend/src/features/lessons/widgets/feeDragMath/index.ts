// Conta do widget `fee-drag` (RC.4.8): o mesmo aporte rendendo o mesmo retorno
// bruto, descontada uma taxa anual diferente em cada produto. A taxa entra
// como desconto sobre o retorno bruto anual (retorno líquido = bruto menos
// taxa), convertido para taxa mensal equivalente; o aporte mensal entra no fim
// de cada mês, como na calculadora de juros compostos.

const MONTHS_PER_YEAR = 12

export interface FeeDragInput {
    initial: number
    monthly: number
    grossReturnPct: number
    feePct: number
    years: number
}

export interface FeeDragPoint {
    year: number
    total: number
}

export interface FeeDragResult {
    points: FeeDragPoint[]
    invested: number
    finalValue: number
    gain: number
}

export function netAnnualReturnPct(grossReturnPct: number, feePct: number): number {
    return grossReturnPct - feePct
}

export function simulateFeeDrag({ initial, monthly, grossReturnPct, feePct, years }: FeeDragInput): FeeDragResult {
    const net = Math.max(-99, netAnnualReturnPct(grossReturnPct, feePct)) / 100
    const monthlyRate = (1 + net) ** (1 / MONTHS_PER_YEAR) - 1
    let total = initial
    const points: FeeDragPoint[] = [{ year: 0, total }]
    for (let month = 1; month <= years * MONTHS_PER_YEAR; month += 1) {
        total = total * (1 + monthlyRate) + monthly
        if (month % MONTHS_PER_YEAR === 0) points.push({ year: month / MONTHS_PER_YEAR, total })
    }
    const invested = initial + monthly * years * MONTHS_PER_YEAR
    return { points, invested, finalValue: total, gain: total - invested }
}

export interface FeeDragComparison {
    a: FeeDragResult
    b: FeeDragResult
    // Quanto o produto de taxa maior termina abaixo do de taxa menor, em reais e em % do saldo final do menor.
    differenceBRL: number
    differencePct: number
    // Fatia do ganho do produto de taxa menor que a taxa maior consome.
    gainShareLostPct: number
}

export function compareFeeDrag(base: Omit<FeeDragInput, 'feePct'>, feeAPct: number, feeBPct: number): FeeDragComparison {
    const a = simulateFeeDrag({ ...base, feePct: feeAPct })
    const b = simulateFeeDrag({ ...base, feePct: feeBPct })
    const differenceBRL = a.finalValue - b.finalValue
    return {
        a,
        b,
        differenceBRL,
        differencePct: a.finalValue === 0 ? 0 : (differenceBRL / a.finalValue) * 100,
        gainShareLostPct: a.gain <= 0 ? 0 : (differenceBRL / a.gain) * 100,
    }
}
