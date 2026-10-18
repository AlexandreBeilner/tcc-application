export type MarketEventType =
  | 'initial_deposit'
  | 'buy_order_executed'
  | 'sell_order_executed'
  | 'fixed_income_purchase'
  | 'fixed_income_redemption'
  | 'dividend_payment'
  // Créditos de caixa livre (folha mensal T.2, correção administrativa N.17): o replay
  // os ignora de propósito, ver o comentário em `replay`.
  | 'salary_payment'
  | 'admin_credit'

export interface MarketEventRecord {
  id: string
  eventType: MarketEventType
  assetId?: string
  quantity?: number
  unitValue?: number
  timestamp: Date
}

// Fluxos de caixa de UMA classe de ativo (só Mercado Ao Vivo, nunca sandbox), somas brutas desde
// a criação da conta. Alimentam a rentabilidade por classe do ranking (renda fixa / renda
// variável): ganho da classe = valor atual + vendas/resgates + proventos - custo investido.
export interface ClassFlows {
  investedCost: number
  disinvestedProceeds: number
  dividendsReceived: number
}

export interface ClassFlowsByClass {
  fixedIncome: ClassFlows
  variableIncome: ClassFlows
}

export interface Snapshot {
  cash: number
  variableIncomeValue: number
  fixedIncomeValue: number
  tradesExecuted: number
  total: number
  // investedCost/disinvestedProceeds/dividendsReceived (tarefa T.1) alimentam
  // a rentabilidade sobre capital de risco (`domain/profitability.ts`) —
  // somas BRUTAS desde a criação da conta, nunca líquidas entre si (uma
  // venda com lucro nunca reduz `investedCost`, só soma em
  // `disinvestedProceeds`). Só Mercado Ao Vivo: o motor não toca em
  // `accounts.total_invested`/`total_disinvested` com ativo sandbox (ponto 063), então o replay
  // também ignora os fluxos desses eventos e os dois caminhos batem.
  investedCost: number
  disinvestedProceeds: number
  dividendsReceived: number
}

export interface ClassFlowsByClass {
  fixedIncome: ClassFlows
  variableIncome: ClassFlows
}

export interface Snapshot {
  cash: number
  variableIncomeValue: number
  fixedIncomeValue: number
  tradesExecuted: number
  total: number
  // investedCost/disinvestedProceeds/dividendsReceived (tarefa T.1) alimentam
  // a rentabilidade sobre capital de risco (`domain/profitability.ts`) —
  // somas BRUTAS desde a criação da conta, nunca líquidas entre si (uma
  // venda com lucro nunca reduz `investedCost`, só soma em
  // `disinvestedProceeds`). Deliberadamente NÃO filtradas por
  // `sandboxAssetIds`, mesma convenção de `cash` (não de
  // `variableIncomeValue`/`fixedIncomeValue`, que filtram): o motor também
  // não filtra `accounts.total_invested`/`total_disinvested`/
  // `total_dividends_received` por `is_sandbox` — filtrar só aqui quebraria
  // a consistência exigida entre este replay e o caminho rápido
  // (`engineCurrentAccountStateReader`, que lê os acumuladores crus do
  // motor).
  investedCost: number
  disinvestedProceeds: number
  dividendsReceived: number
  // Fluxos por classe. Só o replay sabe separar por classe (o estado "agora" do motor guarda
  // acumuladores únicos da conta), então o caminho rápido deixa isto indefinido.
  byClass?: ClassFlowsByClass
  // Renda fixa a custo (`quantidade × preço médio`), preenchido só quando `fixedIncomeValue` foi
  // avaliado pelo valor de hoje (`valuedFixedIncome`). Permite voltar à valorização a custo,
  // a mesma do replay, sem chamar o motor de novo.
  fixedIncomeCostValue?: number
}

// Reconstrói o patrimônio de um usuário num instante passado a partir do
// log append-only (Event Sourcing, 2.1) — RF17 exige o patrimônio no
// **início** da janela, que não existe em lugar nenhum como snapshot; o
// replay evita duplicar estado numa tabela nova. Pura: `events` já vem
// ordenado por timestamp e já filtrado por `timestamp <= asOf` —
// responsabilidade do adapter (application/useCases/getNetWorth.ts).
//
// `cash` soma o efeito dos eventos do Mercado Ao Vivo. Ativo sandbox (Modo Aprendizado) não mexe
// no caixa da conta desde o ponto 063: o motor grava o evento e a posição, mas não debita nem
// credita `accounts.current_balance`, então o replay também ignora o efeito de caixa e de fluxo de
// capital (`investedCost`, `disinvestedProceeds`) desses eventos, para bater com o saldo real hoje
// (`CurrentAccountStateReader`, usado quando `asOf` é omitido). A valorização de posição sandbox
// também fica de fora (spec 3.1: só Mercado Ao Vivo conta pro ranking).
export function replay(
  events: MarketEventRecord[],
  quotesAsOf: Map<string, number>,
  sandboxAssetIds: Set<string>,
): Snapshot {
  let cash = 0
  let tradesExecuted = 0
  let investedCost = 0
  let disinvestedProceeds = 0
  let dividendsReceived = 0
  const classFlows: ClassFlowsByClass = {
    fixedIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
    variableIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
  }
  const isLive = (assetId?: string) => assetId !== undefined && !sandboxAssetIds.has(assetId)
  const variableIncomeQty = new Map<string, number>()
  const fixedIncomeCost = new Map<string, number>()

  for (const event of events) {
    const quantity = event.quantity ?? 0
    const unitValue = event.unitValue ?? 0

    switch (event.eventType) {
      case 'initial_deposit':
        cash += unitValue
        break

      case 'buy_order_executed': {
        const cost = quantity * unitValue
        tradesExecuted += 1
        // Sandbox não mexe no caixa nem nos fluxos de capital (ponto 063).
        if (isLive(event.assetId)) {
          cash -= cost
          investedCost += cost
          classFlows.variableIncome.investedCost += cost
        }
        if (event.assetId && !sandboxAssetIds.has(event.assetId)) {
          variableIncomeQty.set(
            event.assetId,
            (variableIncomeQty.get(event.assetId) ?? 0) + quantity,
          )
        }
        break
      }

      case 'sell_order_executed': {
        const proceeds = quantity * unitValue
        tradesExecuted += 1
        if (isLive(event.assetId)) {
          cash += proceeds
          disinvestedProceeds += proceeds
          classFlows.variableIncome.disinvestedProceeds += proceeds
        }
        if (event.assetId && !sandboxAssetIds.has(event.assetId)) {
          variableIncomeQty.set(
            event.assetId,
            (variableIncomeQty.get(event.assetId) ?? 0) - quantity,
          )
        }
        break
      }

      case 'fixed_income_purchase':
        if (isLive(event.assetId)) {
          cash -= unitValue
          investedCost += unitValue
          classFlows.fixedIncome.investedCost += unitValue
        }
        if (event.assetId && !sandboxAssetIds.has(event.assetId)) {
          fixedIncomeCost.set(event.assetId, (fixedIncomeCost.get(event.assetId) ?? 0) + unitValue)
        }
        break

      case 'fixed_income_redemption':
        if (isLive(event.assetId)) {
          cash += unitValue
          disinvestedProceeds += unitValue
          classFlows.fixedIncome.disinvestedProceeds += unitValue
        }
        // Resgate é sempre integral (3.13) — zera o custo, mesmo se nunca
        // acumulado (ativo sandbox): idempotente, sem efeito nesse caso.
        if (event.assetId) {
          fixedIncomeCost.set(event.assetId, 0)
        }
        break

      case 'dividend_payment': {
        // unitValue aqui é valor POR COTA (`tick.PendingDividendPayment`,
        // `.docs/engine/tick.md`), não o total — total = quantity * unitValue.
        const total = quantity * unitValue
        cash += total
        dividendsReceived += total
        // Provento só existe em ativo de renda variável (ação, FII, ETF).
        if (isLive(event.assetId)) classFlows.variableIncome.dividendsReceived += total
        break
      }

      // Caixa livre que nunca foi capital de risco: não entra em `investedCost`, então
      // não altera a rentabilidade do ranking (T.1). O `cash` deste replay também não
      // os soma (já era assim com `salary_payment`): o patrimônio mostrado ao admin
      // vem do saldo atual do motor (`engineUserPortfolioReader`), não daqui.
      case 'salary_payment':
      case 'admin_credit':
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
    investedCost,
    disinvestedProceeds,
    dividendsReceived,
    byClass: classFlows,
  }
}
