import type { WidgetGoal } from './widgetGoal'

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
  // Ordenar (LJ.2.3): `items` nasce na ordem de autoria e `answer[k]` é o índice (de `items`) que
  // pertence à posição `k`, de cima para baixo. O cliente recebe os itens embaralhados.
  | {
      type: 'check'
      id: string
      kind: 'order'
      prompt: string
      items: string[]
      answer: number[]
      lowLabel?: string
      highLabel?: string
      explanation: string
    }
  // Agrupar (LJ.2.4): `answer[i]` é o índice (de `groups`) a que o item `i` pertence.
  | {
      type: 'check'
      id: string
      kind: 'categorize'
      prompt: string
      groups: string[]
      items: string[]
      answer: number[]
      explanation: string
    }
  // Ligar pares (LJ.2.5): `answer[i]` é o índice (de `right`, na ordem de autoria) que casa com `left[i]`.
  // O cliente recebe `right` embaralhado e confere um par por vez (LJ-D3).
  | {
      type: 'check'
      id: string
      kind: 'match'
      prompt: string
      left: string[]
      right: string[]
      answer: number[]
      explanation: string
    }

export type EstimateUnit = 'brl' | 'pct' | 'years' | 'none'

export type TextBlock = { type: 'text'; markup: string }

export type WidgetBlock = {
  type: 'widget'
  id: string
  widget: WidgetId
  props?: unknown
  caption?: string
  goal?: WidgetGoal
}

// "Saiba mais" (LJ.5.7): detalhe que o caminho principal da lição dispensa (exceção de regra, valor de
// hoje, número complementar). O player mostra como `<details>` recolhido colado ao cartão anterior, então
// não conta como cartão. Só texto e widget sem missão: pergunta e missão são do caminho principal.
export type MoreBlock = {
  type: 'more'
  id: string
  title: string
  blocks: (TextBlock | WidgetBlock)[]
}

export type LessonBlock = TextBlock | WidgetBlock | CheckBlock | MoreBlock

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
  // `order`: itens embaralhados (ver `shuffledIndices`). `categorize`: itens na ordem de autoria e os grupos.
  items?: string[]
  groups?: string[]
  // `match`: coluna da esquerda na ordem de autoria e a da direita embaralhada.
  left?: string[]
  right?: string[]
  lowLabel?: string
  highLabel?: string
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

export function toPublicBlock(block: LessonBlock): PublicLessonBlock {
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
  if (block.kind === 'match') {
    const shuffle = matchShuffle(block)
    return {
      type: 'check',
      id: block.id,
      kind: 'match',
      prompt: block.prompt,
      left: block.left,
      right: shuffle.map((authored) => block.right[authored] as string),
    }
  }
  if (block.kind === 'categorize') {
    return {
      type: 'check',
      id: block.id,
      kind: 'categorize',
      prompt: block.prompt,
      groups: block.groups,
      items: block.items,
    }
  }
  if (block.kind === 'order') {
    const shuffle = orderShuffle(block)
    return {
      type: 'check',
      id: block.id,
      kind: 'order',
      prompt: block.prompt,
      items: shuffle.map((authored) => block.items[authored] as string),
      ...(block.lowLabel ? { lowLabel: block.lowLabel } : {}),
      ...(block.highLabel ? { highLabel: block.highLabel } : {}),
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
  // Ordenar: índices dos itens como o cliente os recebeu (embaralhados), de cima para baixo.
  sequence?: number[]
  // Agrupar: o grupo escolhido para cada item, na ordem dos itens.
  groups?: number[]
  // Ligar: um par por vez, `[índice da esquerda, índice da direita como o cliente o recebeu]`.
  pair?: [number, number]
}

// Quantas peças a resposta acertou, para a dica de contagem dos formatos de várias peças (LJ-D2).
export interface CheckHint {
  correctCount: number
  total: number
}

// Embaralhamento determinístico (semente = id do checkpoint): a revisão mostra a mesma ordem e o
// cliente nunca recebe o gabarito. Mulberry32 sobre um hash FNV-1a da semente.
function seededRandom(seed: string, salt: number): () => number {
  let hash = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  }
  let state = hash >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Permutação de `0..n-1` que não satisfaz `isSolved`. O mesmo `seed` dá sempre a mesma resposta.
export function shuffledIndices(
  n: number,
  seed: string,
  isSolved: (permutation: number[]) => boolean = () => false,
): number[] {
  for (let salt = 0; salt < 50; salt += 1) {
    const random = seededRandom(seed, salt)
    const permutation = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      ;[permutation[i], permutation[j]] = [permutation[j] as number, permutation[i] as number]
    }
    if (!isSolved(permutation)) {
      return permutation
    }
  }
  // Improvável: rotaciona uma posição, o que nunca deixa `0..n-1` igual a si mesmo (n >= 2).
  return Array.from({ length: n }, (_, i) => (i + 1) % n)
}

type OrderBlock = Extract<CheckBlock, { kind: 'order' }>

// `shuffle[j]` é o índice de autoria do item que o cliente vê na posição `j`. Nunca nasce já resolvido.
function orderShuffle(block: OrderBlock): number[] {
  return shuffledIndices(block.items.length, block.id, (permutation) =>
    permutation.every((authored, position) => authored === block.answer[position]),
  )
}

// Posições que a ordem enviada acertou. `sequence[k]` é o item (como o cliente o recebeu) na posição `k`.
export function scoreOrder(block: OrderBlock, sequence: number[]): CheckHint {
  const shuffle = orderShuffle(block)
  const correctCount = sequence.filter(
    (publicIndex, position) => shuffle[publicIndex] === block.answer[position],
  ).length
  return { correctCount, total: block.items.length }
}

type MatchBlock = Extract<CheckBlock, { kind: 'match' }>

// `shuffle[j]` é o índice de autoria do item da direita que o cliente vê na posição `j`. Nunca nasce
// com todos os pares já alinhados linha a linha.
function matchShuffle(block: MatchBlock): number[] {
  return shuffledIndices(block.right.length, block.id, (permutation) =>
    permutation.every((authored, position) => authored === block.answer[position]),
  )
}

// O par `[esquerda, direita embaralhada]` está certo?
export function isPairCorrect(block: MatchBlock, pair: [number, number]): boolean {
  return matchShuffle(block)[pair[1]] === block.answer[pair[0]]
}

type CategorizeBlock = Extract<CheckBlock, { kind: 'categorize' }>

export function scoreCategorize(block: CategorizeBlock, groups: number[]): CheckHint {
  const correctCount = groups.filter((group, item) => group === block.answer[item]).length
  return { correctCount, total: block.items.length }
}

// Formatos de várias peças: a contagem devolvida ao errar (LJ-D2). `undefined` nos demais.
export function hintFor(block: CheckBlock, response: CheckResponse): CheckHint | undefined {
  if (block.kind === 'order' && response.sequence) {
    return scoreOrder(block, response.sequence)
  }
  if (block.kind === 'categorize' && response.groups) {
    return scoreCategorize(block, response.groups)
  }
  return undefined
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
  if (block.kind === 'order') {
    const { sequence } = response
    return (
      Array.isArray(sequence) &&
      sequence.length === block.items.length &&
      new Set(sequence).size === sequence.length &&
      sequence.every((i) => Number.isInteger(i) && i >= 0 && i < block.items.length)
    )
  }
  if (block.kind === 'match') {
    const { pair } = response
    return (
      Array.isArray(pair) &&
      pair.length === 2 &&
      Number.isInteger(pair[0]) &&
      Number.isInteger(pair[1]) &&
      pair[0] >= 0 &&
      pair[0] < block.left.length &&
      pair[1] >= 0 &&
      pair[1] < block.right.length
    )
  }
  if (block.kind === 'categorize') {
    const { groups } = response
    return (
      Array.isArray(groups) &&
      groups.length === block.items.length &&
      groups.every((g) => Number.isInteger(g) && g >= 0 && g < block.groups.length)
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
  if (block.kind === 'order') {
    const { correctCount, total } = scoreOrder(block, response.sequence as number[])
    return correctCount === total
  }
  // Ligar confere um par por vez: aqui "correto" é o par enviado.
  if (block.kind === 'match') {
    return isPairCorrect(block, response.pair as [number, number])
  }
  if (block.kind === 'categorize') {
    const { correctCount, total } = scoreCategorize(block, response.groups as number[])
    return correctCount === total
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
