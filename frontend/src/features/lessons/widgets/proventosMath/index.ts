// Contas dos widgets de proventos e fundos (RC.3.4g). Funções puras. Os números
// tributários espelham os fatos `dividendos-retencao-lei-15270` e `jcp-aliquota`
// de `regulatoryFacts.ts` (backend); a leitura de "quem recebe" segue a regra da B3
// (data com, data ex um dia útil depois).

export const DIVIDEND_WITHHOLDING_PCT = 10
export const DIVIDEND_MONTHLY_THRESHOLD = 50_000
export const JCP_WITHHOLDING_PCT = 17.5

export type DividendSide = 'buy' | 'sell'
export type ProventoKind = 'dividend' | 'jcp'

// Quem tem direito é quem está com a ação no fim da data com. Comprar até a data com
// dá o direito; comprar na data ex ou depois, não. Quem já tinha a ação e vende na data
// ex ou depois ainda recebe; vender até a data com tira o direito.
export function hasDividendRight(side: DividendSide, day: number, comDay: number): boolean {
    return side === 'buy' ? day <= comDay : day > comDay
}

export interface DividendTimelineResult {
    receives: boolean
    gross: number
    priceDropPerShare: number
}

// O preço da ação desconta o valor do provento na data ex: quem comprou depois não leva
// o provento e também não paga por ele. O desconto é por ação, para quem tem direito ou não.
export function dividendTimelineResult(
    side: DividendSide,
    day: number,
    comDay: number,
    quantity: number,
    valuePerShare: number,
): DividendTimelineResult {
    const receives = hasDividendRight(side, day, comDay)
    return { receives, gross: receives ? quantity * valuePerShare : 0, priceDropPerShare: valuePerShare }
}

export interface ProventoNetInput {
    kind: ProventoKind
    quantity: number
    valuePerShare: number
    otherSameMonth: number
    resultsUntil2025: boolean
}

export interface ProventoNetResult {
    gross: number
    withholdingPct: number
    withheld: number
    net: number
    ruleKey: 'dividend-exempt-legacy' | 'dividend-below-threshold' | 'dividend-above-threshold' | 'jcp'
    monthlyTotal: number
}

// Dividendo: de 2026 em diante, retenção de 10% sobre o pagamento quando o total pago
// pela mesma empresa à mesma pessoa no mês passa de R$ 50 mil; abaixo disso, sem
// retenção; lucro apurado até 2025 e aprovado até 31/12/2025 segue isento. JCP: 17,5%.
// O imposto mínimo de altas rendas não entra aqui.
export function proventoNet({ kind, quantity, valuePerShare, otherSameMonth, resultsUntil2025 }: ProventoNetInput): ProventoNetResult {
    const gross = quantity * valuePerShare
    const monthlyTotal = gross + Math.max(0, otherSameMonth)

    let withholdingPct = 0
    let ruleKey: ProventoNetResult['ruleKey'] = 'dividend-below-threshold'
    if (kind === 'jcp') {
        withholdingPct = JCP_WITHHOLDING_PCT
        ruleKey = 'jcp'
    } else if (resultsUntil2025) {
        ruleKey = 'dividend-exempt-legacy'
    } else if (monthlyTotal > DIVIDEND_MONTHLY_THRESHOLD) {
        withholdingPct = DIVIDEND_WITHHOLDING_PCT
        ruleKey = 'dividend-above-threshold'
    }
    const withheld = (gross * withholdingPct) / 100
    return { gross, withholdingPct, withheld, net: gross - withheld, ruleKey, monthlyTotal }
}

export interface EtfHolding {
    name: string
    weightPct: number
}

export interface EtfShockResult {
    changePct: number
    contributions: number[]
    navAfter: number
}

// A variação da cesta é a soma de peso x variação de cada ativo. O NAV por cota parte de navBefore.
export function etfShock(holdings: EtfHolding[], shocksPct: number[], navBefore: number): EtfShockResult {
    const contributions = holdings.map((holding, index) => (holding.weightPct / 100) * (shocksPct[index] ?? 0))
    const changePct = contributions.reduce((sum, value) => sum + value, 0)
    return { changePct, contributions, navAfter: navBefore * (1 + changePct / 100) }
}

export interface FiiYearSummary {
    annualPerShare: number
    annualTotal: number
    dividendYieldPct: number
}

// Dividend Yield anual de um FII que paga o mesmo valor por cota todo mês.
export function fiiYearSummary(monthlyPerShare: number, shares: number, price: number): FiiYearSummary {
    const annualPerShare = monthlyPerShare * 12
    return { annualPerShare, annualTotal: annualPerShare * shares, dividendYieldPct: price > 0 ? (annualPerShare / price) * 100 : 0 }
}

export const MONTH_NAMES = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
]

// O provento de um mês tem data com no último dia útil dele, data ex no 1º dia útil do mês
// seguinte e pagamento no N-ésimo dia útil do mês seguinte. Devolve os rótulos, sem data de calendário.
export function fiiMonthLabels(monthIndex: number, payoutBusinessDay: number): { com: string; ex: string; pay: string } {
    const next = MONTH_NAMES[(monthIndex + 1) % 12]
    return {
        com: `último dia útil de ${MONTH_NAMES[monthIndex]}`,
        ex: `1º dia útil de ${next}`,
        pay: `${payoutBusinessDay}º dia útil de ${next}`,
    }
}
