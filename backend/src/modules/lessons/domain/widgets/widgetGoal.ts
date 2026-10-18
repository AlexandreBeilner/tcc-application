import type { WidgetId } from './lessonBlocks'

// Missão de widget (LJ.3.1): a pessoa mexe nos controles até uma métrica do widget cumprir o alvo, e só então
// o Continuar libera. A conta vive no frontend (o widget calcula e informa a métrica); aqui fica só o contrato
// do bloco e a lista de métricas que cada widget declara, para o conteúdo não apontar para uma métrica que
// não existe.
export type GoalOp = 'lt' | 'lte' | 'gt' | 'gte' | 'between'

export interface WidgetGoal {
  // Frase da missão ("Deixe o rendimento real negativo"), mostrada com o prefixo "Missão:".
  text: string
  metric: string
  op: GoalOp
  // `lt`, `lte`, `gt`, `gte`.
  value?: number
  // `between` (limites incluídos).
  min?: number
  max?: number
  // O que a pessoa aprende ao atingir.
  reveal: string
  // "Me mostra" (LJ-D4): props do widget que levam os controles ao valor-alvo.
  showMe?: Record<string, number | string | boolean>
}

// Métricas que cada widget com missão informa. Espelho do frontend
// (`features/lessons/widgets/goal`), e o teste do widget quebra se a métrica for renomeada.
export const WIDGET_MISSION_METRICS: Partial<Record<WidgetId, readonly string[]>> = {
  'emergency-fund-calculator': ['monthsToReach'],
  'fgc-coverage-bar': ['uncoveredAmount'],
  'growth-calculator': ['interestRatio'],
  'ir-regressive-table': ['irRatePct'],
  'equivalent-rate': ['cdbGapPct'],
  'bond-price-calculator': ['unitPrice'],
  'mtm-seesaw': ['priceChangePct'],
  'breakeven-inflation': ['inflationAboveBreakevenPp'],
  'order-book': ['limitFilledQty'],
  'real-return': ['realReturnPct'],
  'savings-vs-selic': ['savingsGapPct'],
}
