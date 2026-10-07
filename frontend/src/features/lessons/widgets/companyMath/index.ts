// Contas dos widgets de "ler uma empresa" (RC.3.4f). Funções puras. Valores em
// milhões de reais, ações em milhões; o resultado por ação sai em reais.

export interface Dre {
    netRevenue: number
    grossProfit: number
    ebit: number
    ebt: number
    tax: number
    netIncome: number
}

// DRE em cascata: receita líquida, menos custos, menos despesas operacionais,
// mais o resultado financeiro (negativo é despesa de juros), menos o imposto
// sobre o lucro antes do imposto. Prejuízo antes do imposto não paga imposto.
export function dre(netRevenue: number, costsPct: number, expensesPct: number, financialResult: number, taxPct: number): Dre {
    const grossProfit = netRevenue * (1 - costsPct / 100)
    const ebit = grossProfit - netRevenue * (expensesPct / 100)
    const ebt = ebit + financialResult
    const tax = Math.max(0, ebt) * (taxPct / 100)
    return { netRevenue, grossProfit, ebit, ebt, tax, netIncome: ebt - tax }
}

export interface BalanceSheet {
    assets: number
    liabilities: number
    equity: number
}

// Ativo = Passivo + Patrimônio Líquido: o PL é o que sobra do ativo depois das dívidas.
export function balanceSheet(cash: number, fixedAssets: number, debt: number, otherLiabilities: number): BalanceSheet {
    const assets = cash + fixedAssets
    const liabilities = debt + otherLiabilities
    return { assets, liabilities, equity: assets - liabilities }
}

export const marginPct = (value: number, netRevenue: number): number => (netRevenue > 0 ? (value / netRevenue) * 100 : 0)

export interface Dupont {
    marginPct: number
    turnover: number
    leverage: number | null
    roePct: number | null
}

// ROE = lucro líquido / patrimônio líquido = margem líquida x giro do ativo x
// alavancagem (ativo / PL). Com PL zero ou negativo o ROE não tem sentido.
export function dupont(revenue: number, netIncome: number, assets: number, equity: number): Dupont {
    const hasEquity = equity > 0
    return {
        marginPct: revenue > 0 ? (netIncome / revenue) * 100 : 0,
        turnover: assets > 0 ? revenue / assets : 0,
        leverage: hasEquity ? assets / equity : null,
        roePct: hasEquity ? (netIncome / equity) * 100 : null,
    }
}

export interface Multiples {
    eps: number
    bookValuePerShare: number
    pe: number | null
    pb: number | null
    marketCap: number
    earningsYieldPct: number
}

// LPA = lucro / ações; VPA = patrimônio / ações. P/L só faz sentido com lucro
// positivo, e P/VP com patrimônio positivo. Rendimento do lucro = LPA / preço.
export function multiples(price: number, netIncome: number, equity: number, shares: number): Multiples {
    const eps = shares > 0 ? netIncome / shares : 0
    const bookValuePerShare = shares > 0 ? equity / shares : 0
    return {
        eps,
        bookValuePerShare,
        pe: eps > 0 && price > 0 ? price / eps : null,
        pb: bookValuePerShare > 0 && price > 0 ? price / bookValuePerShare : null,
        marketCap: price * shares,
        earningsYieldPct: price > 0 ? (eps / price) * 100 : 0,
    }
}

export type DebtZone = 'low' | 'attention' | 'pressure' | 'none'

// Faixas didáticas do termômetro, não regra de mercado: até 2 vezes o EBIT é
// folgado, até 4 pede atenção, acima disso pesa. Sem EBIT positivo não há leitura.
export const DEBT_ZONE_LIMITS = { attention: 2, pressure: 4 } as const

export interface DebtReading {
    netDebt: number
    netDebtToEbit: number | null
    coverage: number | null
    zone: DebtZone
}

export function debtReading(grossDebt: number, cash: number, ebit: number, financialExpense: number): DebtReading {
    const netDebt = grossDebt - cash
    const netDebtToEbit = ebit > 0 ? netDebt / ebit : null
    const coverage = financialExpense > 0 ? ebit / financialExpense : null
    let zone: DebtZone = 'none'
    if (netDebtToEbit !== null) {
        if (netDebtToEbit <= DEBT_ZONE_LIMITS.attention) zone = 'low'
        else if (netDebtToEbit <= DEBT_ZONE_LIMITS.pressure) zone = 'attention'
        else zone = 'pressure'
    }
    return { netDebt, netDebtToEbit, coverage, zone }
}

// Choque de Selic: a parte da dívida indexada ao CDI paga os pontos a mais.
export function shockedFinancialExpense(financialExpense: number, grossDebt: number, cdiSharePct: number, shockPoints: number): number {
    return financialExpense + grossDebt * (cdiSharePct / 100) * (shockPoints / 100)
}

// O arredondamento tira o ruído de ponto flutuante (-0,00000001 não vira "-0").
export const formatMillions = (value: number): string =>
    `R$ ${(Math.round(value * 10) / 10 + 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
export const formatRatio = (value: number | null): string => (value === null ? 'sem sentido' : `${value.toFixed(2).replace('.', ',')}x`)
export const formatPct = (value: number | null): string => (value === null ? 'sem sentido' : `${value.toFixed(1).replace('.', ',')}%`)
