import { resolveTargets } from '../../news/resolveTargets'
import { findMacroEventTemplate } from '../macroEventTemplates'
import type { NewsEventTarget, TriggerMacroEventInput } from '../../../services/admin'
import type { MacroEventDraft, MacroEventTargetDraft } from './types'

export type { MacroEventDraft, MacroEventTargetDraft, MacroEventTargetKind } from './types'

export function createEmptyTarget(): MacroEventTargetDraft {
    return { id: crypto.randomUUID(), kind: 'sector', value: '' }
}

export function createEmptyMacroEventDraft(): MacroEventDraft {
    return {
        mode: 'template',
        templateKey: '',
        title: '',
        narrative: '',
        direction: 'negativo',
        magnitudeBand: 'moderado',
        affectsPrice: true,
        affectsFundamentals: false,
        targets: [createEmptyTarget()],
        applyOnDay: '',
    }
}

// Espelha `triggerMacroEventBodySchema` (backend, `.claude/arquitetura-
// backend-ddd-lite.md` — dupla validação documentada, o backend continua
// sendo a fonte de verdade) só pra dar feedback mais rápido antes de
// submeter (backlog 6.11). Lista de mensagens, não mapa por campo — forma
// enxuta o bastante pro tamanho do formulário (mesmo padrão de banner único
// já usado por `OrderConfirmationDialog`/`PrivacidadeLgpd`).
export function validateMacroEventDraft(draft: MacroEventDraft, currentDay?: number): string[] {
    const errors: string[] = []

    if (draft.mode === 'template') {
        if (!draft.templateKey) errors.push('Selecione um template do catálogo.')
    } else {
        if (!draft.title.trim()) errors.push('Informe o título do evento.')
        if (draft.title.length > 150) errors.push('O título pode ter no máximo 150 caracteres.')
        if (!draft.narrative.trim()) errors.push('Informe a narrativa do evento.')
        if (!draft.affectsPrice && !draft.affectsFundamentals) {
            errors.push('Selecione ao menos um tipo de efeito (preço e/ou fundamentos).')
        }
    }

    if (draft.targets.length === 0) {
        errors.push('Adicione ao menos um alvo.')
    } else if (draft.targets.some((target) => !target.value)) {
        errors.push('Preencha o valor de todos os alvos (ou remova a linha vazia).')
    }

    const applyDay = parseApplyOnDay(draft.applyOnDay)
    if (applyDay === 'invalid') {
        errors.push('O dia de aplicação precisa ser um número inteiro.')
    } else if (applyDay !== undefined && currentDay !== undefined && applyDay <= currentDay) {
        errors.push(`O dia de aplicação precisa ser posterior ao dia simulado atual (${currentDay}).`)
    }

    return errors
}

// Vazio significa "disparar já" (undefined); texto que não é inteiro é inválido.
function parseApplyOnDay(raw: string): number | 'invalid' | undefined {
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    return /^\d+$/.test(trimmed) ? Number(trimmed) : 'invalid'
}

function toWireTarget(target: MacroEventTargetDraft): NewsEventTarget {
    if (target.kind === 'sector') return { sector: target.value }
    if (target.kind === 'risk_class') return { risk_class: target.value }
    return { asset_id: target.value }
}

// Só chamar depois de `validateMacroEventDraft` devolver `[]` — não
// revalida aqui (a tela é a única chamadora).
export function buildTriggerMacroEventInput(draft: MacroEventDraft): TriggerMacroEventInput {
    const targets = draft.targets.map(toWireTarget)
    const applyDay = parseApplyOnDay(draft.applyOnDay)
    const schedule = typeof applyDay === 'number' ? { apply_on_day: applyDay } : {}

    if (draft.mode === 'template') {
        return { template_key: draft.templateKey, targets, ...schedule }
    }

    return {
        title: draft.title.trim(),
        narrative: draft.narrative.trim(),
        direction: draft.direction,
        magnitude_band: draft.magnitudeBand,
        affects_price: draft.affectsPrice,
        affects_fundamentals: draft.affectsFundamentals,
        targets,
        ...schedule,
    }
}

export interface MacroEventSummaryRow {
    label: string
    value: string
}

const DIRECTION_LABELS = { positivo: 'Alta', negativo: 'Baixa', misto: 'Misto' } as const
const MAGNITUDE_LABELS = { leve: 'Leve', moderado: 'Moderado', severo: 'Severo' } as const

function effectsLabel(affectsPrice: boolean, affectsFundamentals: boolean): string {
    const parts: string[] = []
    if (affectsPrice) parts.push('Preço')
    if (affectsFundamentals) parts.push('Fundamentos')
    return parts.length > 0 ? parts.join(' + ') : '(nenhum)'
}

// Prévia do que será disparado — usada tanto no painel lateral fixo do
// desktop (identidade-visual-padroes.md §7, mesmo raciocínio do ticket de
// ordem do Detalhe de Ativo) quanto no diálogo de confirmação (mobile/
// tablet/desktop) de `MacroEventTriggerForm`, os dois consumindo a mesma
// função pra nunca divergir em conteúdo. `assetLabels` só é usado pra
// alvos do tipo `asset` (mesmo padrão de `NewsEventList`/`resolveTargets`).
export function buildMacroEventSummaryRows(draft: MacroEventDraft, assetLabels: Record<string, string> = {}): MacroEventSummaryRow[] {
    const rows: MacroEventSummaryRow[] = []

    if (draft.mode === 'template') {
        const template = findMacroEventTemplate(draft.templateKey)
        rows.push({ label: 'Template', value: template?.title ?? '(nenhum selecionado)' })
        if (template) {
            rows.push({ label: 'Direção', value: DIRECTION_LABELS[template.direction] })
            rows.push({ label: 'Magnitude', value: MAGNITUDE_LABELS[template.band] })
            rows.push({ label: 'Efeitos', value: effectsLabel(template.affectsPrice, template.affectsFundamentals) })
        }
    } else {
        rows.push({ label: 'Título', value: draft.title || '(vazio)' })
        rows.push({ label: 'Direção', value: DIRECTION_LABELS[draft.direction] })
        rows.push({ label: 'Magnitude', value: MAGNITUDE_LABELS[draft.magnitudeBand] })
        rows.push({ label: 'Efeitos', value: effectsLabel(draft.affectsPrice, draft.affectsFundamentals) })
    }

    const filledTargets = draft.targets.filter((target) => target.value)
    const targetLabels = resolveTargets(filledTargets.map(toWireTarget), assetLabels).map((target) => target.label)
    rows.push({ label: 'Alvos', value: targetLabels.length > 0 ? targetLabels.join(', ') : '(nenhum)' })
    const applyDay = parseApplyOnDay(draft.applyOnDay)
    rows.push({
        label: 'Efeito começa',
        value: typeof applyDay === 'number' ? `No dia simulado ${applyDay} (agendado)` : 'No próximo tick (já)',
    })

    return rows
}
