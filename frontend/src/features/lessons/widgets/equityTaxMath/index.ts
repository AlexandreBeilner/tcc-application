// Contas dos widgets de imposto em renda variável (RC.4.7). Funções puras. Os números
// espelham os fatos `acoes-isencao-20-mil`, `renda-variavel-aliquotas` e `etf-ir` /
// `fii-ganho-capital` de `regulatoryFacts.ts` (backend). Simplificações: não calcula
// o DARF mínimo, não trata o prejuízo de day trade em corretoras diferentes nem o
// imposto sobre o lucro de ativos diferentes no mesmo dia.

export const EXEMPT_MONTHLY_SALES = 20_000
export const SWING_RATE_PCT = 15
export const DAY_TRADE_RATE_PCT = 20
export const FII_RATE_PCT = 20
export const SWING_WITHHOLDING_PCT = 0.005

export type TradeKind = 'swing' | 'daytrade'
export type AssetClass = 'stock' | 'etf' | 'fii'

export interface EquityTaxInput {
    kind: TradeKind
    assetClass: AssetClass
    // Total vendido no mês, em reais (conta para a isenção; não é o lucro).
    salesMonth: number
    // Lucro (positivo) ou prejuízo (negativo) do mês nessas vendas.
    profit: number
    // Prejuízo de meses anteriores do mesmo tipo de operação, ainda não compensado.
    lossCarry: number
}

export type EquityTaxRule = 'loss' | 'exempt' | 'compensated' | 'taxed'

export interface EquityTaxResult {
    rule: EquityTaxRule
    ratePct: number
    taxableBase: number
    tax: number
    // Prejuízo que sobra para os próximos meses (do mesmo tipo de operação).
    lossCarryAfter: number
    // "Dedo-duro" do swing trade: retenção de 0,005% sobre o valor vendido, que abate do imposto.
    withholding: number
}

export function rateFor(kind: TradeKind, assetClass: AssetClass): number {
    if (kind === 'daytrade') return DAY_TRADE_RATE_PCT
    return assetClass === 'fii' ? FII_RATE_PCT : SWING_RATE_PCT
}

export function isExempt(kind: TradeKind, assetClass: AssetClass, salesMonth: number): boolean {
    return kind === 'swing' && assetClass === 'stock' && salesMonth <= EXEMPT_MONTHLY_SALES
}

export function equityTax({ kind, assetClass, salesMonth, profit, lossCarry }: EquityTaxInput): EquityTaxResult {
    const ratePct = rateFor(kind, assetClass)
    const withholding = kind === 'swing' ? (salesMonth * SWING_WITHHOLDING_PCT) / 100 : 0
    if (profit <= 0) {
        return { rule: 'loss', ratePct, taxableBase: 0, tax: 0, lossCarryAfter: lossCarry + -profit, withholding }
    }
    if (isExempt(kind, assetClass, salesMonth)) {
        return { rule: 'exempt', ratePct, taxableBase: 0, tax: 0, lossCarryAfter: lossCarry, withholding }
    }
    const taxableBase = Math.max(0, profit - lossCarry)
    const tax = (taxableBase * ratePct) / 100
    const lossCarryAfter = Math.max(0, lossCarry - profit)
    return { rule: lossCarry > 0 ? 'compensated' : 'taxed', ratePct, taxableBase, tax, lossCarryAfter, withholding }
}

// Valor do DARF: o imposto menos o que a corretora já reteve (dedo-duro).
export function darfAmount(result: EquityTaxResult): number {
    return Math.max(0, result.tax - result.withholding)
}

export interface TaxDecision {
    headline: string
    detail: string
}

// Árvore de decisão do widget `tax-decision-tree`: 3 perguntas levam a um resultado.
export function taxDecision(assetClass: AssetClass, sameDay: boolean, salesUpTo20k: boolean | null): TaxDecision {
    if (sameDay) {
        return {
            headline: `Day trade: ${DAY_TRADE_RATE_PCT}% sobre o lucro, sem isenção.`,
            detail: 'Não importa o valor vendido nem a classe do ativo. O imposto é apurado no mês e pago em DARF até o último dia útil do mês seguinte.',
        }
    }
    if (assetClass === 'stock') {
        return salesUpTo20k
            ? {
                  headline: 'Ganho isento de imposto.',
                  detail: `As vendas de ações no mês ficaram em até R$ 20 mil, então não há DARF. Você ainda declara a operação no IR, em rendimentos isentos.`,
              }
            : {
                  headline: `Swing trade: ${SWING_RATE_PCT}% sobre o lucro do mês.`,
                  detail: 'Passou de R$ 20 mil em vendas de ações no mês, então todo o lucro é tributado, não só o que passou do limite. Paga DARF até o último dia útil do mês seguinte.',
              }
    }
    return assetClass === 'etf'
        ? {
              headline: `ETF: ${SWING_RATE_PCT}% sobre o lucro, sem isenção.`,
              detail: 'A isenção de R$ 20 mil vale só para ações. O ETF paga imposto sobre qualquer lucro de venda, com DARF até o último dia útil do mês seguinte.',
          }
        : {
              headline: `FII: ${FII_RATE_PCT}% sobre o lucro, sem isenção.`,
              detail: 'A isenção de R$ 20 mil vale só para ações. O ganho na venda de cotas de FII é tributado. Os rendimentos mensais, para pessoa física, têm regra própria.',
          }
}
