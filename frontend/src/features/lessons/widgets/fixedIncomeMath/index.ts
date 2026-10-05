// Contas dos widgets de renda fixa das lições (RC.3.4a). Funções puras, sem
// motor nem rede: a tabela regressiva é a de `ir-renda-fixa-regressivo` em
// `backend/src/modules/lessons/domain/regulatoryFacts.ts` (Lei 11.033/2004,
// art. 1º); mudar lá exige mudar aqui.
export interface IrBracket {
    label: string
    fromDay: number
    toDay: number | null
    ratePct: number
}

export const IR_BRACKETS: IrBracket[] = [
    { label: 'Até 180 dias', fromDay: 1, toDay: 180, ratePct: 22.5 },
    { label: 'De 181 a 360 dias', fromDay: 181, toDay: 360, ratePct: 20 },
    { label: 'De 361 a 720 dias', fromDay: 361, toDay: 720, ratePct: 17.5 },
    { label: 'Acima de 720 dias', fromDay: 721, toDay: null, ratePct: 15 },
]

export function irBracketForDays(days: number): IrBracket {
    const day = Math.max(1, Math.trunc(days))
    return IR_BRACKETS.find((bracket) => bracket.toDay === null || day <= bracket.toDay) ?? IR_BRACKETS[IR_BRACKETS.length - 1]
}

export function irRatePctForDays(days: number): number {
    return irBracketForDays(days).ratePct
}

// Taxa que um produto tributado precisa pagar para empatar, líquido de IR, com
// um produto isento: taxa isenta / (1 - alíquota).
export function equivalentGrossRatePct(exemptRatePct: number, irRatePct: number): number {
    return exemptRatePct / (1 - irRatePct / 100)
}

// Taxa líquida de um produto tributado: taxa bruta x (1 - alíquota).
export function netRatePct(grossRatePct: number, irRatePct: number): number {
    return grossRatePct * (1 - irRatePct / 100)
}

export interface IrOnYield {
    ratePct: number
    tax: number
    net: number
}

export function irOnYield(grossYield: number, days: number): IrOnYield {
    const ratePct = irRatePctForDays(days)
    const tax = grossYield * (ratePct / 100)
    return { ratePct, tax, net: grossYield - tax }
}

export interface ProductInput {
    name: string
    annualRatePct: number
    taxExempt: boolean
}

export interface ProductResult {
    name: string
    grossYield: number
    tax: number
    netYield: number
    netFinal: number
}

// Rendimento no prazo com capitalização anual: valor x ((1 + taxa)^(dias/365) - 1).
// IR retido sobre o rendimento, só nos produtos tributados.
export function productResult(product: ProductInput, amount: number, days: number): ProductResult {
    const grossYield = amount * ((1 + product.annualRatePct / 100) ** (days / 365) - 1)
    const tax = product.taxExempt ? 0 : grossYield * (irRatePctForDays(days) / 100)
    const netYield = grossYield - tax
    return { name: product.name, grossYield, tax, netYield, netFinal: amount + netYield }
}

// Índice do produto com maior rendimento líquido, ou null em empate.
export function winnerIndex(results: ProductResult[]): number | null {
    if (results.length === 0) return null
    const best = Math.max(...results.map((r) => r.netYield))
    const winners = results.flatMap((r, i) => (Math.abs(r.netYield - best) < 0.005 ? [i] : []))
    return winners.length === 1 ? winners[0] : null
}
