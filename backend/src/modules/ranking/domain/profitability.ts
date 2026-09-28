import type { Snapshot } from './networth'

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
