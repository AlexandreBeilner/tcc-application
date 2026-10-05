// Tipos do contrato `blocks` do conteúdo visual das lições (RC.3.1, RC.3.2). A
// validação (Zod) vive em `infrastructure/content/lessonBlocks.ts`: o domínio
// não importa biblioteca externa. Cada fase vira uma lista de blocos tipados;
// `lessons.blocks` nulo faz o player usar o texto legado.
export type WidgetId =
  | 'callout'
  | 'platform-note'
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
  | {
      type: 'check'
      id: string
      kind: 'numeric'
      prompt: string
      answer: number
      tolerance: number
      unit?: string
      explanation: string
    }

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
}

// Versão do bloco que pode ir ao cliente: sem gabarito nem explicação.
export interface PublicCheckBlock {
  type: 'check'
  id: string
  kind: CheckBlock['kind']
  prompt: string
  // `true_false` sempre expõe as duas alternativas na ordem [Verdadeiro, Falso].
  options?: string[]
  unit?: string
}

export type PublicLessonBlock = Exclude<LessonBlock, CheckBlock> | PublicCheckBlock

export interface PublicLessonBlocks {
  schemaVersion: 1
  phases: {
    scenario: PublicLessonBlock[]
    microDecision: PublicLessonBlock[]
    revelation: PublicLessonBlock[]
  }
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
  if (block.kind === 'true_false') {
    return {
      type: 'check',
      id: block.id,
      kind: 'true_false',
      prompt: block.prompt,
      options: TRUE_FALSE_OPTIONS,
    }
  }
  return {
    type: 'check',
    id: block.id,
    kind: 'numeric',
    prompt: block.prompt,
    ...(block.unit ? { unit: block.unit } : {}),
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

export interface CheckResponse {
  selectedOption?: number
  value?: number
}

// Resposta válida pro formato do bloco? (índice dentro das alternativas, número finito.)
export function isValidCheckResponse(block: CheckBlock, response: CheckResponse): boolean {
  if (block.kind === 'numeric') {
    return typeof response.value === 'number' && Number.isFinite(response.value)
  }
  const optionCount = block.kind === 'single' ? block.options.length : TRUE_FALSE_OPTIONS.length
  return (
    typeof response.selectedOption === 'number' &&
    Number.isInteger(response.selectedOption) &&
    response.selectedOption >= 0 &&
    response.selectedOption < optionCount
  )
}

export function isCheckCorrect(block: CheckBlock, response: CheckResponse): boolean {
  if (block.kind === 'single') {
    return response.selectedOption === block.answer
  }
  if (block.kind === 'true_false') {
    // índice 0 = Verdadeiro, 1 = Falso
    return response.selectedOption === (block.answer ? 0 : 1)
  }
  return Math.abs((response.value ?? Number.NaN) - block.answer) <= block.tolerance
}
