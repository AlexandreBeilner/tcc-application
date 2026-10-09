// Conta do widget `budget-split` (RC.4.4). Função pura. A regra 50/30/20 é uma regra de
// bolso popular (não consta do Caderno de Educação Financeira do Banco Central): 50% da
// renda para necessidades, 30% para desejos e 20% para poupar e quitar dívidas.

export const RULE_NEEDS_PCT = 50
export const RULE_WANTS_PCT = 30
export const RULE_SAVE_PCT = 20

export type BudgetCategory = 'housing' | 'food' | 'transport' | 'leisure' | 'debts' | 'other'

export const BUDGET_CATEGORIES: { key: BudgetCategory; label: string }[] = [
    { key: 'housing', label: 'Moradia' },
    { key: 'food', label: 'Alimentação' },
    { key: 'transport', label: 'Transporte' },
    { key: 'leisure', label: 'Lazer' },
    { key: 'debts', label: 'Dívidas' },
    { key: 'other', label: 'Outros' },
]

export type BudgetValues = Record<BudgetCategory, number>

export interface BudgetSplitResult {
    spent: number
    // Renda menos gastos; negativa quando o orçamento fecha no vermelho.
    surplus: number
    surplusPct: number
    overspent: boolean
    // Fatias da renda segundo a regra de bolso: necessidades (moradia, alimentação, transporte),
    // desejos (lazer e outros) e poupar/quitar (dívidas mais a sobra).
    needsPct: number
    wantsPct: number
    saveDebtPct: number
}

const share = (value: number, income: number) => (income <= 0 ? 0 : (value / income) * 100)

export function budgetSplit(income: number, values: BudgetValues): BudgetSplitResult {
    const spent = BUDGET_CATEGORIES.reduce((sum, { key }) => sum + values[key], 0)
    const surplus = income - spent
    return {
        spent,
        surplus,
        surplusPct: share(surplus, income),
        overspent: surplus < 0,
        needsPct: share(values.housing + values.food + values.transport, income),
        wantsPct: share(values.leisure + values.other, income),
        saveDebtPct: share(values.debts + surplus, income),
    }
}
