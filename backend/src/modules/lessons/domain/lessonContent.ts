import type { MicroDecisionType } from './lesson'

// Conteúdo editável de uma lição (N.23): tudo que o painel pode mudar. `stable_key`, `code`,
// `trackNumber`, `trackName` e `sortOrder` ficam de fora de propósito (identidade e posição, não
// conteúdo). Também é o formato do retrato guardado em cada revisão.
export interface LessonContent {
  title: string
  centralConcept: string
  scenarioText: string
  microDecisionPrompt: string
  microDecisionType: MicroDecisionType
  microDecisionAssetTicker: string | null
  microDecisionOptions: string[] | null
  microDecisionCorrectOption: number | null
  revelationText: string
  unlocksDescription: string | null
  unlocksKeys: string[]
  unlocksAssetTicker: string | null
}

export const MICRO_DECISION_TYPES: readonly MicroDecisionType[] = [
  'reflection',
  'growth_calculator',
  'fixed_income_comparison',
  'live_indicator',
  'live_macro_indicator',
]

// Tipos de micro-decisão que embutem um widget com interação própria: a aposta com opções não faz
// sentido neles (a tela da lição ignora as opções), então o domínio recusa em vez de gravar texto
// que ninguém veria.
const EMBEDDED_WIDGET_TYPES: readonly MicroDecisionType[] = [
  'growth_calculator',
  'fixed_income_comparison',
]

// Vocabulário fechado de chaves de desbloqueio (tarefa 7.0.1): funcionalidades fixas mais
// `asset:<AssetType>`, com `AssetType` espelhando 1:1 `catalog.AssetType` do motor.
export const UNLOCK_FEATURE_KEYS: readonly string[] = ['portfolio', 'calculator', 'news_feed']
export const ASSET_TYPES: readonly string[] = [
  'tesouro_selic',
  'tesouro_prefixado',
  'tesouro_ipca',
  'cdb',
  'lci',
  'lca',
  'cri',
  'cra',
  'acao',
  'etf',
  'fii',
]
const ASSET_KEY_PREFIX = 'asset:'

export const LESSON_LIMITS = {
  title: 150,
  centralConcept: 500,
  longText: 5000,
  unlocksDescription: 500,
  optionsMin: 2,
  optionsMax: 6,
  optionLength: 200,
  ticker: 20,
} as const

export interface ContentCheck {
  // Recusas: o conteúdo não pode ser gravado.
  errors: string[]
  // Avisos: gravável, mas o admin deve olhar (regra de copy do produto).
  warnings: string[]
}

const TEXT_FIELD_LABELS: Record<string, string> = {
  title: 'título',
  centralConcept: 'conceito central',
  scenarioText: 'cenário',
  microDecisionPrompt: 'micro-decisão',
  revelationText: 'revelação',
  unlocksDescription: 'descrição do desbloqueio',
}

export function isAssetKey(key: string): boolean {
  return key.startsWith(ASSET_KEY_PREFIX)
}

export function assetTypeOfKey(key: string): string {
  return key.slice(ASSET_KEY_PREFIX.length)
}

// Travessão como pontuação é regra de copy do produto (texto que o usuário lê não usa "—"): vira
// aviso, não bloqueio, pra o admin decidir.
function dashWarnings(content: LessonContent): string[] {
  const warnings: string[] = []
  for (const [field, label] of Object.entries(TEXT_FIELD_LABELS)) {
    const value = content[field as keyof LessonContent]
    if (typeof value === 'string' && value.includes('—')) {
      warnings.push(`o campo ${label} usa travessão (—) como pontuação; o texto do produto evita`)
    }
  }
  for (const option of content.microDecisionOptions ?? []) {
    if (option.includes('—')) {
      warnings.push(
        'uma das opções da aposta usa travessão (—) como pontuação; o texto do produto evita',
      )
      break
    }
  }
  return warnings
}

function checkTexts(content: LessonContent, errors: string[]): void {
  if (content.title.trim().length === 0) errors.push('o título é obrigatório')
  if (content.title.length > LESSON_LIMITS.title) {
    errors.push(`o título passa de ${LESSON_LIMITS.title} caracteres`)
  }
  if (content.centralConcept.trim().length === 0) errors.push('o conceito central é obrigatório')
  if (content.centralConcept.length > LESSON_LIMITS.centralConcept) {
    errors.push(`o conceito central passa de ${LESSON_LIMITS.centralConcept} caracteres`)
  }
  for (const field of ['scenarioText', 'microDecisionPrompt', 'revelationText'] as const) {
    if (content[field].length > LESSON_LIMITS.longText) {
      errors.push(
        `o campo ${TEXT_FIELD_LABELS[field]} passa de ${LESSON_LIMITS.longText} caracteres`,
      )
    }
  }
  if (
    content.unlocksDescription !== null &&
    content.unlocksDescription.length > LESSON_LIMITS.unlocksDescription
  ) {
    errors.push(
      `a descrição do desbloqueio passa de ${LESSON_LIMITS.unlocksDescription} caracteres`,
    )
  }
}

function checkMicroDecision(content: LessonContent, errors: string[]): void {
  if (!MICRO_DECISION_TYPES.includes(content.microDecisionType)) {
    errors.push('tipo de micro-decisão desconhecido')
    return
  }

  const needsTicker = content.microDecisionType === 'live_indicator'
  if (needsTicker && !content.microDecisionAssetTicker) {
    errors.push('o indicador de ativo ao vivo exige o ticker do ativo')
  }
  if (!needsTicker && content.microDecisionAssetTicker !== null) {
    errors.push('só o indicador de ativo ao vivo usa ticker na micro-decisão')
  }

  const { microDecisionOptions: options, microDecisionCorrectOption: correct } = content
  if (options === null && correct === null) return
  if (options === null || correct === null) {
    errors.push('a aposta precisa das opções e da opção correta juntas')
    return
  }
  if (EMBEDDED_WIDGET_TYPES.includes(content.microDecisionType)) {
    errors.push('a calculadora e o comparador já são a interação do passo: não levam aposta')
  }
  if (options.length < LESSON_LIMITS.optionsMin || options.length > LESSON_LIMITS.optionsMax) {
    errors.push(`a aposta tem de ${LESSON_LIMITS.optionsMin} a ${LESSON_LIMITS.optionsMax} opções`)
  }
  if (options.some((o) => o.trim().length === 0 || o.length > LESSON_LIMITS.optionLength)) {
    errors.push(`cada opção precisa de texto e no máximo ${LESSON_LIMITS.optionLength} caracteres`)
  }
  if (new Set(options.map((o) => o.trim())).size !== options.length) {
    errors.push('as opções da aposta não podem se repetir')
  }
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    errors.push('a opção correta precisa ser uma das opções da aposta')
  }
}

function checkUnlocks(content: LessonContent, errors: string[]): void {
  const keys = content.unlocksKeys
  if (new Set(keys).size !== keys.length) errors.push('há chaves de desbloqueio repetidas')
  for (const key of keys) {
    const valid = isAssetKey(key)
      ? ASSET_TYPES.includes(assetTypeOfKey(key))
      : UNLOCK_FEATURE_KEYS.includes(key)
    if (!valid) errors.push(`chave de desbloqueio desconhecida: ${key}`)
  }
  const hasAssetKey = keys.some(isAssetKey)
  if (hasAssetKey && !content.unlocksAssetTicker) {
    errors.push('chave de produto (asset:*) exige o ticker do produto desbloqueado')
  }
  if (!hasAssetKey && content.unlocksAssetTicker !== null) {
    errors.push('o ticker do produto desbloqueado só vale com uma chave de produto (asset:*)')
  }
}

// Regras de conteúdo que não dependem de nada externo (N.23). A parte que consulta o catálogo do
// motor (o ticker existe? é do tipo da chave?) é `ContentTickerChecker`, na camada de aplicação.
export function checkLessonContent(content: LessonContent): ContentCheck {
  const errors: string[] = []
  checkTexts(content, errors)
  checkMicroDecision(content, errors)
  checkUnlocks(content, errors)
  for (const ticker of [content.microDecisionAssetTicker, content.unlocksAssetTicker]) {
    if (ticker !== null && (ticker.trim().length === 0 || ticker.length > LESSON_LIMITS.ticker)) {
      errors.push('ticker inválido')
    }
  }
  return { errors, warnings: dashWarnings(content) }
}

// Campos cujo valor mudou entre dois conteúdos, pra auditoria e pra tela do histórico (nunca o
// texto inteiro no log: só quais campos).
export function changedFields(
  before: LessonContent,
  after: LessonContent,
): (keyof LessonContent)[] {
  const keys = Object.keys(before) as (keyof LessonContent)[]
  return keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}

export function contentOf(lesson: LessonContent): LessonContent {
  return {
    title: lesson.title,
    centralConcept: lesson.centralConcept,
    scenarioText: lesson.scenarioText,
    microDecisionPrompt: lesson.microDecisionPrompt,
    microDecisionType: lesson.microDecisionType,
    microDecisionAssetTicker: lesson.microDecisionAssetTicker,
    microDecisionOptions: lesson.microDecisionOptions,
    microDecisionCorrectOption: lesson.microDecisionCorrectOption,
    revelationText: lesson.revelationText,
    unlocksDescription: lesson.unlocksDescription,
    unlocksKeys: lesson.unlocksKeys,
    unlocksAssetTicker: lesson.unlocksAssetTicker,
  }
}
