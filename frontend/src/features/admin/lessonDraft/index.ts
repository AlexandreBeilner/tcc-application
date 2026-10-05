import type { AdminLessonContent, LessonMicroDecisionType } from '../../../services/admin'

// Estado do formulário de edição de lição (N.23): texto cru dos campos, antes de virar o conteúdo da API.
export interface LessonDraft {
    title: string
    centralConcept: string
    scenarioText: string
    microDecisionPrompt: string
    microDecisionType: LessonMicroDecisionType
    microDecisionAssetTicker: string
    hasBet: boolean
    options: string[]
    correctOption: number
    revelationText: string
    unlocksDescription: string
    unlocksKeys: string[]
    unlocksAssetTicker: string
}

export const MIN_BET_OPTIONS = 2
export const MAX_BET_OPTIONS = 6

// Tipos cujo widget já é a interação do passo: a aposta com opções não vale neles (o domínio recusa).
export const EMBEDDED_WIDGET_TYPES: readonly LessonMicroDecisionType[] = ['growth_calculator', 'fixed_income_comparison']

export const MICRO_DECISION_TYPE_OPTIONS: { value: LessonMicroDecisionType; label: string }[] = [
    { value: 'reflection', label: 'Reflexão (com ou sem aposta)' },
    { value: 'growth_calculator', label: 'Calculadora de crescimento' },
    { value: 'fixed_income_comparison', label: 'Comparador de renda fixa' },
    { value: 'live_indicator', label: 'Indicador de ativo ao vivo' },
    { value: 'live_macro_indicator', label: 'Indicador macro ao vivo' },
]

// Vocabulário fechado de chaves de desbloqueio (espelho de `domain/lessonContent.ts` do backend, que é quem valida).
export const UNLOCK_FEATURE_OPTIONS: { key: string; label: string }[] = [
    { key: 'portfolio', label: 'Portfólio' },
    { key: 'calculator', label: 'Calculadora' },
    { key: 'news_feed', label: 'Notícias' },
]

export const UNLOCK_ASSET_OPTIONS: { key: string; label: string }[] = [
    { key: 'asset:tesouro_selic', label: 'Tesouro Selic' },
    { key: 'asset:tesouro_prefixado', label: 'Tesouro Prefixado' },
    { key: 'asset:tesouro_ipca', label: 'Tesouro IPCA+' },
    { key: 'asset:cdb', label: 'CDB' },
    { key: 'asset:lci', label: 'LCI' },
    { key: 'asset:lca', label: 'LCA' },
    { key: 'asset:cri', label: 'CRI' },
    { key: 'asset:cra', label: 'CRA' },
    { key: 'asset:acao', label: 'Ações' },
    { key: 'asset:etf', label: 'ETFs' },
    { key: 'asset:fii', label: 'FIIs' },
]

export function emptyDraft(): LessonDraft {
    return {
        title: '',
        centralConcept: '',
        scenarioText: '',
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: '',
        hasBet: false,
        options: ['', ''],
        correctOption: 0,
        revelationText: '',
        unlocksDescription: '',
        unlocksKeys: [],
        unlocksAssetTicker: '',
    }
}

export function draftFromContent(content: AdminLessonContent): LessonDraft {
    const options = content.micro_decision_options
    return {
        title: content.title,
        centralConcept: content.central_concept,
        scenarioText: content.scenario_text,
        microDecisionPrompt: content.micro_decision_prompt,
        microDecisionType: content.micro_decision_type,
        microDecisionAssetTicker: content.micro_decision_asset_ticker ?? '',
        hasBet: options !== null,
        options: options ?? ['', ''],
        correctOption: content.micro_decision_correct_option ?? 0,
        revelationText: content.revelation_text,
        unlocksDescription: content.unlocks_description ?? '',
        unlocksKeys: content.unlocks_keys,
        unlocksAssetTicker: content.unlocks_asset_ticker ?? '',
    }
}

export function hasAssetKey(keys: string[]): boolean {
    return keys.some((key) => key.startsWith('asset:'))
}

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim())

// Formulário → conteúdo da API. Só manda o que faz sentido pro tipo escolhido (ticker só no indicador de
// ativo, aposta só fora dos widgets embutidos, ticker do produto só com chave de produto), então trocar o
// tipo no meio da edição não deixa lixo de um tipo anterior no conteúdo. As regras de verdade são do backend.
export function draftToContent(draft: LessonDraft): AdminLessonContent {
    const betAllowed = draft.hasBet && !EMBEDDED_WIDGET_TYPES.includes(draft.microDecisionType)
    return {
        title: draft.title.trim(),
        central_concept: draft.centralConcept.trim(),
        scenario_text: draft.scenarioText,
        micro_decision_prompt: draft.microDecisionPrompt,
        micro_decision_type: draft.microDecisionType,
        micro_decision_asset_ticker: draft.microDecisionType === 'live_indicator' ? blankToNull(draft.microDecisionAssetTicker) : null,
        micro_decision_options: betAllowed ? draft.options.map((option) => option.trim()) : null,
        micro_decision_correct_option: betAllowed ? draft.correctOption : null,
        revelation_text: draft.revelationText,
        unlocks_description: blankToNull(draft.unlocksDescription),
        unlocks_keys: draft.unlocksKeys,
        unlocks_asset_ticker: hasAssetKey(draft.unlocksKeys) ? blankToNull(draft.unlocksAssetTicker) : null,
    }
}

// O formulário difere do conteúdo salvo? Compara depois da mesma normalização, então só espaço sobrando
// ou campo de outro tipo não conta como edição.
export function isDraftDirty(draft: LessonDraft, saved: AdminLessonContent): boolean {
    return JSON.stringify(draftToContent(draft)) !== JSON.stringify(draftToContent(draftFromContent(saved)))
}

export function addOption(draft: LessonDraft): LessonDraft {
    return draft.options.length >= MAX_BET_OPTIONS ? draft : { ...draft, options: [...draft.options, ''] }
}

// Remover uma opção mantém a correta apontando pra mesma opção (ou pra anterior, se a removida era a correta).
export function removeOption(draft: LessonDraft, index: number): LessonDraft {
    if (draft.options.length <= MIN_BET_OPTIONS) return draft
    const options = draft.options.filter((_, i) => i !== index)
    let correctOption = draft.correctOption
    if (index < correctOption) correctOption -= 1
    else if (index === correctOption) correctOption = Math.max(0, correctOption - 1)
    return { ...draft, options, correctOption: Math.min(correctOption, options.length - 1) }
}

export function toggleUnlockKey(draft: LessonDraft, key: string): LessonDraft {
    const unlocksKeys = draft.unlocksKeys.includes(key) ? draft.unlocksKeys.filter((k) => k !== key) : [...draft.unlocksKeys, key]
    return { ...draft, unlocksKeys }
}

// Rótulo curto de uma revisão pro histórico.
export const REVISION_ACTION_LABELS = {
    baseline: 'Versão original (antes da primeira edição)',
    create: 'Criação',
    update: 'Edição',
    restore: 'Restauração',
} as const

export const CONTENT_FIELD_LABELS: Record<keyof AdminLessonContent, string> = {
    title: 'Título',
    central_concept: 'Conceito central',
    scenario_text: 'Cenário',
    micro_decision_prompt: 'Micro-decisão',
    micro_decision_type: 'Tipo de micro-decisão',
    micro_decision_asset_ticker: 'Ticker do indicador',
    micro_decision_options: 'Opções da aposta',
    micro_decision_correct_option: 'Opção correta',
    revelation_text: 'Revelação',
    unlocks_description: 'Texto do desbloqueio',
    unlocks_keys: 'Chaves de desbloqueio',
    unlocks_asset_ticker: 'Ticker do produto',
}

// Campos que diferem entre dois conteúdos, pra mostrar o que uma revisão mudaria na lição atual.
export function diffContent(from: AdminLessonContent, to: AdminLessonContent): (keyof AdminLessonContent)[] {
    return (Object.keys(CONTENT_FIELD_LABELS) as (keyof AdminLessonContent)[]).filter(
        (key) => JSON.stringify(from[key]) !== JSON.stringify(to[key]),
    )
}

// Valor de um campo como texto legível (lista vira linhas, vazio vira "vazio").
export function formatContentValue(value: AdminLessonContent[keyof AdminLessonContent]): string {
    if (value === null || value === '') return 'vazio'
    if (Array.isArray(value)) return value.length === 0 ? 'vazio' : value.join(', ')
    return String(value)
}
