import type { MarketEventRecord, Snapshot } from './networth'

export function profitabilityPct(baseline: number, current: number): number {
  // Guarda defensiva — baseline nunca deveria ser 0 na prática (toda conta
  // nasce com R$10.000, RNF06), mas divisão por zero não pode virar
  // Infinity/NaN numa resposta pública de ranking.
  if (baseline === 0) {
    return 0
  }
  return ((current - baseline) / baseline) * 100
}

// RiskCapitalSnapshot (tarefa T.1) é o subconjunto de `Snapshot` que alimenta
// a rentabilidade sobre capital de risco — nunca sobre caixa nunca investido
// (ex. salário, depósito inicial parado): `currentInvestedValue` é o valor
// de mercado de tudo que ainda está posicionado agora (renda variável +
// renda fixa), `disinvestedProceeds`/`dividendsReceived` são o que já foi
// devolvido em caixa (venda/resgate/provento) — realizado ou não realizado,
// os dois contam igual pro mesmo ganho.
export interface RiskCapitalSnapshot {
  investedCost: number
  disinvestedProceeds: number
  dividendsReceived: number
  currentInvestedValue: number
}

const ZERO_RISK_CAPITAL_SNAPSHOT: RiskCapitalSnapshot = {
  investedCost: 0,
  disinvestedProceeds: 0,
  dividendsReceived: 0,
  currentInvestedValue: 0,
}

export function toRiskCapitalSnapshot(snapshot: Snapshot): RiskCapitalSnapshot {
  return {
    investedCost: snapshot.investedCost,
    disinvestedProceeds: snapshot.disinvestedProceeds,
    dividendsReceived: snapshot.dividendsReceived,
    currentInvestedValue: snapshot.variableIncomeValue + snapshot.fixedIncomeValue,
  }
}

// riskCapitalGain é o lucro/prejuízo total gerado por capital já colocado em
// risco até este instante — realizado (`disinvestedProceeds`,
// `dividendsReceived`) e não realizado (`currentInvestedValue`), líquido do
// custo bruto histórico (`investedCost`, nunca reduzido por venda).
function riskCapitalGain(snapshot: RiskCapitalSnapshot): number {
  return (
    snapshot.currentInvestedValue +
    snapshot.disinvestedProceeds +
    snapshot.dividendsReceived -
    snapshot.investedCost
  )
}

// ATENÇÃO: o ranking Global/Amigos e as ligas NÃO usam mais esta fórmula (denominador = custo
// investido bruto acumulado); usam o Dietz modificado, no fim deste arquivo
// (`investmentDietzReturnPct`/`classDietzReturnPct`). Ela segue valendo para duelos,
// retrospectiva mensal e perfil, que medem um período entre dois instantes sem extrato de fluxos.
//
// investmentReturnPct (tarefa T.1) substitui `profitabilityPct` como a
// fórmula de rentabilidade do ranking (RF17) — decisão do autor: nunca sobre
// caixa nunca investido (salário, depósito inicial parado), sempre sobre
// capital que já foi de risco.
//
// `baseline` (opcional, default zero) é o que permite a mesma janela fixa
// (semana/mês) que o ranking já tinha antes desta tarefa, sem reabrir a
// vantagem permanente de quem entrou primeiro (`gain` cresce/cai desde a
// criação da conta, mas o retorno da JANELA é só o que esse ganho mudou
// entre baseline e agora): vender com lucro uma posição comprada antes da
// janela, sem reinvestir, ainda soma no retorno da janela — o custo (`X`)
// se cancela na subtração dos dois ganhos, só o movimento real (proventos +
// venda − valorização perdida) sobra. Chamado sem `baseline` (ou com o zero
// default), dá o retorno **desde a criação da conta** — é exatamente esse
// caso que os testes table-driven cobrem isoladamente (compra parcial,
// venda com lucro/perda, dividendo recebido ainda posicionado, sem operação
// nenhuma).
//
// O guard usa `current.investedCost` (nunca `baseline.investedCost`): quem
// nunca investiu nada (em nenhum momento, dentro ou fora da janela) dá 0%,
// não -100% nem Infinity — e quem investiu só DENTRO da janela (baseline
// zerado) ainda tem denominador não-zero em `current`, então o retorno da
// janela conta normalmente.
export function investmentReturnPct(
  current: RiskCapitalSnapshot,
  baseline: RiskCapitalSnapshot = ZERO_RISK_CAPITAL_SNAPSHOT,
): number {
  if (current.investedCost === 0) {
    return 0
  }
  return ((riskCapitalGain(current) - riskCapitalGain(baseline)) / current.investedCost) * 100
}

// Capital de uma classe de ativo (renda fixa ou variável) num instante: os fluxos brutos da
// classe mais o valor de mercado do que ainda está posicionado nela.
export interface ClassRiskCapital {
  investedCost: number
  disinvestedProceeds: number
  dividendsReceived: number
  currentValue: number
}

function classGain(snapshot: ClassRiskCapital): number {
  return (
    snapshot.currentValue +
    snapshot.disinvestedProceeds +
    snapshot.dividendsReceived -
    snapshot.investedCost
  )
}

// Rentabilidade da JANELA numa classe, com a mesma lógica do critério geral (`investmentReturnPct`)
// restrita à classe: quanto o ganho da classe mudou entre o começo da janela e agora, sobre o
// custo investido nela. Vender com lucro, receber provento e a valorização contam igual, e
// aportar mais durante a janela não infla o percentual (o aporte entra no custo e no valor).
//
// `null` quando o usuário nunca investiu na classe (custo zero): fica fora do ranking dela, em
// vez de aparecer com um 0% enganoso. Quem investiu só DENTRO da janela (baseline zerado) entra.
export function classReturnPct(
  current: ClassRiskCapital,
  baseline: ClassRiskCapital,
): number | null {
  if (current.investedCost === 0) {
    return null
  }
  return ((classGain(current) - classGain(baseline)) / current.investedCost) * 100
}

// ---------------------------------------------------------------------------------------------
// Retorno pelo método de Dietz modificado (ranking Global/Amigos e ligas)
// ---------------------------------------------------------------------------------------------
//
// Método: Dietz modificado (Dietz, 1966), o mesmo que o GIPS (CFA Institute, 2019, provisão
// 2.A.24) admite para retorno ponderado pelo tempo na ausência de valoração a cada fluxo:
//
//   R = (EMV − BMV − ΣFᵢ) / (BMV + Σ wᵢ·Fᵢ),   wᵢ = (T − tᵢ) / T
//
// - EMV − BMV − ΣFᵢ é o numerador que o ranking já usa (`riskCapitalGain` do fim menos o do
//   começo da janela): valorização + vendas/resgates + proventos − custo investido.
// - BMV é o valor investido no começo da janela (`currentInvestedValue` do baseline).
// - Fᵢ são os fluxos de capital DENTRO da janela, com sinal: compras e aplicações são positivas
//   (capital entrando em risco); vendas, resgates e proventos são negativos (capital voltando
//   ao caixa).
// - T é a duração da janela, contada a partir do instante do baseline (a amostra do job, ou o
//   começo da janela / a criação da conta quando não há amostra); tᵢ é o instante do fluxo
//   desde esse início. Um aporte logo no começo pesa quase 1; um aporte no fim, quase 0.
//
// Por que não o denominador antigo (custo investido bruto acumulado no fim da janela): ele
// diluía o retorno de quem aportava perto do fim e penalizava quem comprava e vendia muito,
// porque o custo bruto nunca diminui. Aqui um aporte só pesa pelo tempo que ficou em risco.
//
// Duelos, retrospectiva e perfil continuam com `investmentReturnPct`, acima (decisão do autor).

// Fluxo de capital datado. `amount` > 0 entra em risco (compra/aplicação); < 0 volta ao caixa
// (venda, resgate, provento).
export interface DatedFlow {
  at: Date
  amount: number
}

// Os fluxos da janela, no critério geral e por classe (mesmos filtros do `replay`).
export interface WindowFlows {
  overall: DatedFlow[]
  fixedIncome: DatedFlow[]
  variableIncome: DatedFlow[]
}

// Extrai dos eventos os fluxos de capital em (after, upTo], na mesma convenção de `replay`:
// sandbox fora dos fluxos de capital; provento no critério geral sempre (como
// `dividendsReceived`) e por classe só no Mercado Ao Vivo; folha e crédito administrativo não
// são capital de risco.
export function extractWindowFlows(
  events: MarketEventRecord[],
  sandboxAssetIds: Set<string>,
  after: Date,
  upTo: Date,
): WindowFlows {
  const flows: WindowFlows = { overall: [], fixedIncome: [], variableIncome: [] }
  const isLive = (assetId?: string) => assetId !== undefined && !sandboxAssetIds.has(assetId)

  for (const event of events) {
    const at = event.timestamp
    if (at.getTime() <= after.getTime() || at.getTime() > upTo.getTime()) continue
    const quantity = event.quantity ?? 0
    const unitValue = event.unitValue ?? 0

    switch (event.eventType) {
      case 'buy_order_executed':
        if (isLive(event.assetId)) {
          flows.overall.push({ at, amount: quantity * unitValue })
          flows.variableIncome.push({ at, amount: quantity * unitValue })
        }
        break
      case 'sell_order_executed':
        if (isLive(event.assetId)) {
          flows.overall.push({ at, amount: -(quantity * unitValue) })
          flows.variableIncome.push({ at, amount: -(quantity * unitValue) })
        }
        break
      case 'fixed_income_purchase':
        if (isLive(event.assetId)) {
          flows.overall.push({ at, amount: unitValue })
          flows.fixedIncome.push({ at, amount: unitValue })
        }
        break
      case 'fixed_income_redemption':
        if (isLive(event.assetId)) {
          flows.overall.push({ at, amount: -unitValue })
          flows.fixedIncome.push({ at, amount: -unitValue })
        }
        break
      case 'dividend_payment':
        // unitValue é o valor por cota; o total é quantity × unitValue.
        flows.overall.push({ at, amount: -(quantity * unitValue) })
        if (isLive(event.assetId)) {
          flows.variableIncome.push({ at, amount: -(quantity * unitValue) })
        }
        break
      default:
        break
    }
  }
  return flows
}

// Denominador de Dietz: BMV + Σ wᵢ·Fᵢ, com wᵢ = (T − tᵢ) / T sobre [start, end].
export function dietzDenominator(
  startValue: number,
  flows: DatedFlow[],
  start: Date,
  end: Date,
): number {
  const duration = end.getTime() - start.getTime()
  if (duration <= 0) return startValue
  let weighted = 0
  for (const flow of flows) {
    const elapsed = flow.at.getTime() - start.getTime()
    weighted += ((duration - elapsed) / duration) * flow.amount
  }
  return startValue + weighted
}

// Critério geral pelo Dietz modificado. Quem nunca investiu fica com 0% (como antes); denominador
// ≤ 0 (nada ficou em risco na janela) também dá 0%, nunca um percentual absurdo, e continua no
// ranking geral.
export function investmentDietzReturnPct(
  current: RiskCapitalSnapshot,
  baseline: RiskCapitalSnapshot,
  flows: DatedFlow[],
  start: Date,
  end: Date,
): number {
  if (current.investedCost === 0) {
    return 0
  }
  const denominator = dietzDenominator(baseline.currentInvestedValue, flows, start, end)
  if (denominator <= 0) {
    return 0
  }
  return ((riskCapitalGain(current) - riskCapitalGain(baseline)) / denominator) * 100
}

// Critério por classe pelo Dietz modificado. `null` (fora do ranking da classe) para quem nunca
// investiu na classe e para denominador ≤ 0.
export function classDietzReturnPct(
  current: ClassRiskCapital,
  baseline: ClassRiskCapital,
  flows: DatedFlow[],
  start: Date,
  end: Date,
): number | null {
  if (current.investedCost === 0) {
    return null
  }
  const denominator = dietzDenominator(baseline.currentValue, flows, start, end)
  if (denominator <= 0) {
    return null
  }
  return ((classGain(current) - classGain(baseline)) / denominator) * 100
}
