export type MarketEventType =
  | 'initial_deposit'
  | 'buy_order_executed'
  | 'sell_order_executed'
  | 'fixed_income_purchase'
  | 'fixed_income_redemption'
  | 'dividend_payment'

export interface MarketEventRecord {
  id: string
  eventType: MarketEventType
  assetId?: string
  quantity?: number
  unitValue?: number
  timestamp: Date
}

export interface Snapshot {
  cash: number
  variableIncomeValue: number
  fixedIncomeValue: number
  tradesExecuted: number
  total: number
}

// Reconstrói o patrimônio de um usuário num instante passado a partir do
// log append-only (Event Sourcing, 2.1) — RF17 exige o patrimônio no
// **início** da janela, que não existe em lugar nenhum como snapshot; o
// replay evita duplicar estado numa tabela nova. Pura: `events` já vem
// ordenado por timestamp e já filtrado por `timestamp <= asOf` —
// responsabilidade do adapter (application/useCases/getNetWorth.ts).
//
// `cash` soma o efeito de TODO evento, incluindo os de ativo sandbox — o
// motor debita/credita `accounts.current_balance` de verdade numa operação
// sandbox (mesmo fluxo de execução da 4.11, `.docs/engine/orders.md`), e
// isso precisa bater com o saldo real hoje (`CurrentAccountStateReader`,
// usado quando `asOf` é omitido) — excluir sandbox do lado do caixa
// divergiria do saldo real e quebraria a consistência passado↔presente.
// `sandboxAssetIds` só exclui a **valorização de posição** (spec 3.1: só
// Mercado Ao Vivo conta pro ranking) — decisão desta sessão, não confirmada
// explicitamente, documentada aqui porque tem consequência prática: gastar
// caixa real num ativo sandbox reduz patrimônio sem contrapartida em valor.
export function replay(
  events: MarketEventRecord[],
  quotesAsOf: Map<string, number>,
  sandboxAssetIds: Set<string>,
): Snapshot {
  let cash = 0
  let tradesExecuted = 0
  const variableIncomeQty = new Map<string, number>()
  const fixedIncomeCost = new Map<string, number>()

  for (const event of events) {
    const quantity = event.quantity ?? 0
    const unitValue = event.unitValue ?? 0

    switch (event.eventType) {
      case 'initial_deposit':
        cash += unitValue
        break

      case 'buy_order_executed':
        cash -= quantity * unitValue
        tradesExecuted += 1
        if (event.assetId && !sandboxAssetIds.has(event.assetId)) {
          variableIncomeQty.set(
            event.assetId,
            (variableIncomeQty.get(event.assetId) ?? 0) + quantity,
          )
        }
        break

      case 'sell_order_executed':
        cash += quantity * unitValue
        tradesExecuted += 1
        if (event.assetId && !sandboxAssetIds.has(event.assetId)) {
          variableIncomeQty.set(
            event.assetId,
            (variableIncomeQty.get(event.assetId) ?? 0) - quantity,
          )
        }
        break

      case 'fixed_income_purchase':
        cash -= unitValue
        if (event.assetId && !sandboxAssetIds.has(event.assetId)) {
          fixedIncomeCost.set(event.assetId, (fixedIncomeCost.get(event.assetId) ?? 0) + unitValue)
        }
        break

      case 'fixed_income_redemption':
        cash += unitValue
        // Resgate é sempre integral (3.13) — zera o custo, mesmo se nunca
        // acumulado (ativo sandbox): idempotente, sem efeito nesse caso.
        if (event.assetId) {
          fixedIncomeCost.set(event.assetId, 0)
        }
        break

      case 'dividend_payment':
        // unitValue aqui é valor POR COTA (`tick.PendingDividendPayment`,
        // `.docs/engine/tick.md`), não o total — total = quantity * unitValue.
        cash += quantity * unitValue
        break
    }
  }

  let variableIncomeValue = 0
  for (const [assetId, qty] of variableIncomeQty) {
    variableIncomeValue += qty * (quotesAsOf.get(assetId) ?? 0)
  }

  let fixedIncomeValue = 0
  for (const cost of fixedIncomeCost.values()) {
    fixedIncomeValue += cost
  }

  return {
    cash,
    variableIncomeValue,
    fixedIncomeValue,
    tradesExecuted,
    total: cash + variableIncomeValue + fixedIncomeValue,
  }
}
