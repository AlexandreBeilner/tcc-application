// Tipos do contrato `blocks` do conteúdo visual das lições (RC.3.1, RC.3.2). A
// validação (Zod) vive em `infrastructure/content/lessonBlocks.ts`: o domínio
// não importa biblioteca externa. Cada fase vira uma lista de blocos tipados;
// `lessons.blocks` nulo faz o player usar o texto legado.
export type WidgetId =
  | 'callout'
  | 'platform-note'
  | 'formula-walkthrough'
  | 'equivalent-rate'
  | 'ir-regressive-table'
  | 'product-comparator'
  | 'compound-growth'
  | 'real-return'
  | 'selic-ipca-chart'
  | 'copom-timeline'
  | 'inflation-selic-seesaw'
  | 'emergency-fund-calculator'
  | 'where-to-keep'
  | 'mtm-seesaw'
  | 'fgc-coverage-bar'
  | 'rating-ruler'
  | 'bond-price-calculator'
  | 'ipca-plus-simulator'
  | 'breakeven-inflation'
  | 'ownership-calculator'
  | 'bookbuilding-simulator'
  | 'ticker-decoder'
  | 'headline-triage'
  | 'order-book'
  | 'interactive-balance'
  | 'margin-comparator'
  | 'roe-lab'
  | 'multiples-calculator'
  | 'debt-thermometer'
  | 'dividend-timeline'
  | 'dividend-net-calculator'
  | 'etf-shock-simulator'
  | 'fii-monthly-calendar'
  | 'fee-drag'
  | 'risk-return-scatter'
  | 'allocation-donut'
  | 'risk-profile-quiz'
  | 'behavior-bias-quiz'
  | 'budget-split'
  | 'debt-snowball'
  | 'pay-or-invest'
  | 'equity-tax-calculator'
  | 'tax-decision-tree'
  | 'savings-vs-selic'
  | 'growth-calculator'
  | 'fixed-income-comparison'
  | 'live-indicator'
  | 'live-macro'

// Pergunta intermediária (RC.3.2). `answer` e `explanation` são o gabarito e
// nunca saem do servidor (`toPublicBlocks`): o gabarito só aparece junto do
// acerto (D3).
export type CheckBlock =
  | {
      type: 'check'
      id: string
      kind: 'single'
      prompt: string
      options: string[]
      answer: number
      explanation: string
    }
  | {
      type: 'check'
      id: string
      kind: 'true_false'
      prompt: string
      answer: boolean
      explanation: string
    }
  // Estimativa (LJ.2.2): previsão, não prova. `answer` é o valor real; `tolerancePct` é a
  // faixa (relativa ao valor real) que conta como "na mosca". Nunca trava o Continuar (LJ-D1).
  | {
      type: 'check'
      id: string
      kind: 'estimate'
      prompt: string
      min: number
      max: number
      step: number
      unit: EstimateUnit
      answer: number
      tolerancePct: number
      explanation: string
    }

export type EstimateUnit = 'brl' | 'pct' | 'years' | 'none'

export type LessonBlock =
  | { type: 'text'; markup: string }
  | { type: 'widget'; id: string; widget: WidgetId; props?: unknown; caption?: string }
  | CheckBlock

export interface LessonBlocks {
  schemaVersion: 1
  phases: {
    scenario: LessonBlock[]
    microDecision: LessonBlock[]
    revelation: LessonBlock[]
  }
  // "O que ficou" (LJ.1.5): 2 a 3 frases curtas mostradas na tela final da lição.
  // Opcional: lição sem resumo só não mostra o bloco.
  summary?: string[]
}

// Versão do bloco que pode ir ao cliente: sem gabarito nem explicação.
export interface PublicCheckBlock {
  type: 'check'
  id: string
  kind: CheckBlock['kind']
  prompt: string
  // `true_false` sempre expõe as duas alternativas na ordem [Verdadeiro, Falso].
  options?: string[]
  // Só `estimate`: a régua do controle. O valor real e a tolerância ficam no servidor.
  range?: { min: number; max: number; step: number; unit: EstimateUnit }
}

export type PublicLessonBlock = Exclude<LessonBlock, CheckBlock> | PublicCheckBlock

export interface PublicLessonBlocks {
  schemaVersion: 1
  phases: {
    scenario: PublicLessonBlock[]
    microDecision: PublicLessonBlock[]
    revelation: PublicLessonBlock[]
  }
  summary?: string[]
}

export const TRUE_FALSE_OPTIONS = ['Verdadeiro', 'Falso']

// Fase do player por índice de passo (0 Cenário, 1 Micro-decisão, 2 Revelação).
export const PHASE_BY_STEP = ['scenario', 'microDecision', 'revelation'] as const

function toPublicBlock(block: LessonBlock): PublicLessonBlock {
  if (block.type !== 'check') {
    return block
  }
  if (block.kind === 'single') {
    return {
      type: 'check',
      id: block.id,
      kind: 'single',
      prompt: block.prompt,
      options: block.options,
    }
  }
  if (block.kind === 'estimate') {
    return {
      type: 'check',
      id: block.id,
      kind: 'estimate',
      prompt: block.prompt,
      range: { min: block.min, max: block.max, step: block.step, unit: block.unit },
    }
  }
  return {
    type: 'check',
    id: block.id,
    kind: 'true_false',
    prompt: block.prompt,
    options: TRUE_FALSE_OPTIONS,
  }
}

export function toPublicBlocks(blocks: LessonBlocks | null | undefined): PublicLessonBlocks | null {
  if (!blocks) {
    return null
  }
  return {
    schemaVersion: 1,
    phases: {
      scenario: blocks.phases.scenario.map(toPublicBlock),
      microDecision: blocks.phases.microDecision.map(toPublicBlock),
      revelation: blocks.phases.revelation.map(toPublicBlock),
    },
    ...(blocks.summary ? { summary: blocks.summary } : {}),
  }
}

export function allBlocks(blocks: LessonBlocks | null | undefined): LessonBlock[] {
  return blocks
    ? [...blocks.phases.scenario, ...blocks.phases.microDecision, ...blocks.phases.revelation]
    : []
}

export function findCheckBlock(
  blocks: LessonBlocks | null | undefined,
  checkpointId: string,
): CheckBlock | undefined {
  return allBlocks(blocks).find((b): b is CheckBlock => b.type === 'check' && b.id === checkpointId)
}

// Checkpoints que o aluno precisa resolver pra sair de uma fase (0, 1 ou 2).
export function checkpointIdsForStep(
  blocks: LessonBlocks | null | undefined,
  step: number,
): string[] {
  const phase = PHASE_BY_STEP[step]
  if (!blocks || !phase) {
    return []
  }
  return blocks.phases[phase].flatMap((b) => (b.type === 'check' ? [b.id] : []))
}

// Resposta por formato: `selectedOption` (única escolha e verdadeiro/falso) ou `value`
// (estimativa). Os formatos de várias peças (ordenar, agrupar, ligar) entram com os seus
// campos nas tarefas LJ.2.3 a LJ.2.5.
export interface CheckResponse {
  selectedOption?: number
  value?: number
}

// Quanto o chute passou perto: dentro da tolerância, até 2x a tolerância, ou longe.
export type EstimateBand = 'exact' | 'close' | 'far'

export interface EstimateOutcome {
  band: EstimateBand
  // Valor real e a faixa de tolerância em volta dele (mostrados só depois de responder).
  value: number
  low: number
  high: number
}

// O que a estimativa devolve depois de respondida (LJ-D1): o chute e o resultado.
export interface EstimateResult extends EstimateOutcome {
  guess: number
}

type EstimateBlock = Extract<CheckBlock, { kind: 'estimate' }>

export function classifyEstimate(block: EstimateBlock, guess: number): EstimateOutcome {
  const tolerance = (Math.abs(block.answer) * block.tolerancePct) / 100
  const distance = Math.abs(guess - block.answer)
  // Pequena folga pra o ponto flutuante não tirar da faixa um chute exatamente na borda.
  const epsilon = 1e-9 * Math.max(1, Math.abs(block.answer))
  const band: EstimateBand =
    distance <= tolerance + epsilon
      ? 'exact'
      : distance <= 2 * tolerance + epsilon
        ? 'close'
        : 'far'
  return {
    band,
    value: block.answer,
    low: block.answer - tolerance,
    high: block.answer + tolerance,
  }
}

// Resposta válida pro formato do bloco? (índice dentro das alternativas; valor
// finito dentro da régua da estimativa.)
export function isValidCheckResponse(block: CheckBlock, response: CheckResponse): boolean {
  if (block.kind === 'estimate') {
    return (
      typeof response.value === 'number' &&
      Number.isFinite(response.value) &&
      response.value >= block.min &&
      response.value <= block.max
    )
  }
  const optionCount = block.kind === 'single' ? block.options.length : TRUE_FALSE_OPTIONS.length
  return (
    typeof response.selectedOption === 'number' &&
    Number.isInteger(response.selectedOption) &&
    response.selectedOption >= 0 &&
    response.selectedOption < optionCount
  )
}

// Estimativa "acerta" quando cai na tolerância ("na mosca"); mesmo errando ela avança (LJ-D1).
export function isCheckCorrect(block: CheckBlock, response: CheckResponse): boolean {
  if (block.kind === 'estimate') {
    return classifyEstimate(block, response.value as number).band === 'exact'
  }
  if (block.kind === 'single') {
    return response.selectedOption === block.answer
  }
  // índice 0 = Verdadeiro, 1 = Falso
  return response.selectedOption === (block.answer ? 0 : 1)
}

// Formatos que resolvem na primeira resposta, certa ou não (LJ-D1).
export function resolvesOnFirstAnswer(block: CheckBlock): boolean {
  return block.kind === 'estimate'
}
