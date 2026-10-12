import { ApiError } from '../../../services/client'
import type {
    AdminAssembly,
    AdminAssemblyStatus,
    AgendaTemplate,
    AgendaTemplateContent,
    AgendaTemplateEffect,
    AdminEffectPreview,
    AssemblyPause,
    AssemblySettingKey,
    CatalogAsset,
} from '../../../services/admin'
import type { EffectDraft, OptionDraft, SettingText, TemplateDraft } from './types'

export type { EffectDraft, OptionDraft, SettingText, TemplateDraft } from './types'

export const REASON_MAX_LENGTH = 300
export const TEMPLATE_OPTIONS_MIN = 2
export const TEMPLATE_OPTIONS_MAX = 4
// Uma opção mexe em no máximo duas alavancas.
export const OPTION_EFFECTS_MIN = 1
export const OPTION_EFFECTS_MAX = 2

// Texto digitado pra confirmar a pausa global (regra transversal 6 da Fase N).
export const PAUSE_ALL_CONFIRMATION = 'PAUSAR ASSEMBLEIAS'

// Parâmetros do backend. O que vale para "as próximas" está dito em cada efeito: a assembleia já
// aberta mantém o quórum e o prazo com que abriu.
export const ASSEMBLY_SETTING_TEXT: Record<AssemblySettingKey, SettingText> = {
    min_voters: {
        title: 'Mínimo de votantes',
        unit: 'pessoas',
        effect: 'Abaixo disso a pauta não passa e nada muda. A assembleia que já está aberta mantém o mínimo com que abriu.',
    },
    duration_days: {
        title: 'Duração da votação',
        unit: 'dias reais',
        effect: 'Quanto tempo a votação fica aberta. Vale para as próximas assembleias.',
    },
    open_delay_days: {
        title: 'Espera depois do balanço',
        unit: 'dias simulados',
        effect: 'Quantos dias do mercado depois do balanço a assembleia da empresa abre.',
    },
    catch_up_days: {
        title: 'Janela de recuperação',
        unit: 'dias simulados',
        effect: 'Até quantos dias além da espera ainda se abre uma assembleia que o ciclo perdeu (por exemplo, com o servidor parado ou uma pausa).',
    },
    effect_delay_days: {
        title: 'Espera até o efeito',
        unit: 'dias reais',
        effect: 'Quanto tempo depois de fechar o resultado vira efeito nos fundamentos da empresa. Vale para as próximas assembleias.',
    },
    monthly_free_credits: {
        title: 'Votos gratuitos por mês',
        unit: 'votos',
        effect: 'Quantas assembleias por mês quem não é PRO pode votar, de empresas que possui.',
    },
    free_credit_min_level: {
        title: 'Nível mínimo do voto gratuito',
        unit: 'nível',
        effect: 'Nível mínimo para usar o voto gratuito (o e-mail verificado também é exigido).',
    },
    participation_xp: {
        title: 'XP por participar',
        unit: 'XP',
        effect: 'XP concedido uma vez por assembleia, no primeiro voto. Nunca depende de o lado ter vencido.',
    },
    proposal_monthly_cap: {
        title: 'Propostas por mês',
        unit: 'propostas',
        effect: 'Quantas pautas novas cada pessoa PRO pode propor por mês. Apoiar não gasta.',
    },
    proposal_min_support: {
        title: 'Apoios mínimos',
        unit: 'apoios',
        effect: 'Apoios para uma proposta poder ser escolhida (quem propôs conta como o primeiro).',
    },
    proposal_ttl_days: {
        title: 'Validade da proposta',
        unit: 'dias reais',
        effect: 'Quanto tempo uma proposta fica na fila antes de expirar.',
    },
}

export const ASSEMBLY_STATUS_LABELS: Record<AdminAssemblyStatus, string> = {
    scheduled: 'Agendada',
    open: 'Aberta',
    closed: 'Encerrada',
}

const OUTCOME_REASON_LABELS: Record<NonNullable<AdminAssembly['outcome_reason']>, string> = {
    decided: 'Decidida',
    quorum: 'Sem o mínimo de votantes',
    tie: 'Empate (nada muda)',
}

export function describeOutcome(assembly: AdminAssembly): string {
    if (assembly.status !== 'closed' || !assembly.outcome) return '—'
    const reason = assembly.outcome_reason ? OUTCOME_REASON_LABELS[assembly.outcome_reason] : ''
    return assembly.outcome === 'approved' ? 'Aprovada' : `Não aprovada${reason ? `: ${reason}` : ''}`
}

// Situação do efeito no mundo: só faz sentido para assembleia aprovada.
export function describeEffect(assembly: AdminAssembly): string | null {
    if (assembly.outcome !== 'approved') return null
    if (assembly.effect_applied_at) return 'Efeito aplicado'
    return assembly.effect_pending ? 'Efeito pendente' : 'Efeito agendado'
}

export function pauseScopeLabel(pause: AssemblyPause, companyNames: ReadonlyMap<string, string>): string {
    if (pause.scope === 'global') return 'Todas as assembleias'
    return (pause.company_id && companyNames.get(pause.company_id)) || 'Uma empresa'
}

// Empresas do catálogo (uma por company_id: ON e PN dividem a mesma), para escolher a pausada.
export function companyOptions(catalog: readonly CatalogAsset[] | undefined): Array<{ id: string; name: string }> {
    const byId = new Map<string, string>()
    for (const asset of catalog ?? []) {
        if (asset.company && !byId.has(asset.company.company_id)) byId.set(asset.company.company_id, asset.company.name)
    }
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function pausedCompanyIds(active: readonly AssemblyPause[]): Set<string> {
    return new Set(active.flatMap((p) => (p.scope === 'company' && p.company_id ? [p.company_id] : [])))
}

export function hasGlobalPause(active: readonly AssemblyPause[]): boolean {
    return active.some((p) => p.scope === 'global')
}

// Mensagens por situação conhecida; o 422 traz a regra do backend (faixa, tamanho, efeito).
export function describeAssemblyError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 409) return 'O estado mudou (pausa já vigente, já retomada, ou chave repetida). A lista foi atualizada.'
        if (err.status === 404) return 'Isso não existe mais.'
        if (err.status === 422) return err.message
        if (err.status === 400) return 'Dados inválidos: confira os campos.'
    }
    return 'Não foi possível concluir agora. Confira a auditoria antes de tentar de novo.'
}

const METRICS: Record<string, string> = {
    base_growth_pct: 'Crescimento',
    quality_multiplier: 'Qualidade',
    payout_ratio_pct: 'Payout (parte do lucro distribuída)',
    pn_dividend_premium_pct: 'Prêmio da ação PN',
    dividend_policy: 'Política de dividendo',
}

export const METRIC_OPTIONS = Object.entries(METRICS).map(([value, label]) => ({ value, label }))

export const POLICY_METRIC = 'dividend_policy'

export const DIRECTION_OPTIONS = [
    { value: '1', label: 'Sobe' },
    { value: '-1', label: 'Desce' },
]

export const POLICY_OPTIONS = [
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'semiannual', label: 'Semestral' },
    { value: 'annual', label: 'Anual' },
]

export const PURPOSE_OPTIONS = [
    { value: 'general', label: 'Geral (abre depois do balanço)' },
    { value: 'profit', label: 'Destinação do lucro (abre quando o dividendo fica retido)' },
]

export function blankEffect(): EffectDraft {
    return { metric: 'base_growth_pct', direction: '1', intensity: '0,5', value: 'quarterly' }
}

export function blankOption(): OptionDraft {
    return { key: '', label: '', gain: '', loss: '', effects: [blankEffect()] }
}

export function blankDraft(): TemplateDraft {
    return { key: '', purpose: 'general', sector: '', title: '', description: '', options: [blankOption(), blankOption()] }
}

function formatIntensity(value: number): string {
    return String(value).replace('.', ',')
}

// Os efeitos de uma opção, no formato novo (`{ effects: [...] }`) ou no antigo (um efeito só).
export function readTemplateEffects(effect: AgendaTemplate['options'][number]['effect']): AgendaTemplateEffect[] {
    return 'effects' in effect && Array.isArray(effect.effects) ? effect.effects : [effect as AgendaTemplateEffect]
}

function toEffectDraft(effect: AgendaTemplateEffect): EffectDraft {
    return {
        metric: effect.metric,
        direction: effect.direction === -1 ? '-1' : '1',
        intensity: formatIntensity(effect.intensity ?? 0.5),
        value: effect.value ?? 'quarterly',
    }
}

export function toDraft(template: AgendaTemplate): TemplateDraft {
    return {
        key: template.key,
        purpose: template.purpose ?? 'general',
        sector: template.sector ?? '',
        title: template.title,
        description: template.description,
        options: template.options.map((o) => ({
            key: o.key,
            label: o.label,
            gain: o.gain,
            loss: o.loss,
            effects: readTemplateEffects(o.effect).map(toEffectDraft),
        })),
    }
}

// Converte o rascunho no conteúdo enviado. Só confere o que o formulário precisa pra montar o
// pedido (campo vazio, intensidade que não é número, alavanca repetida); tamanho e faixa são do
// backend (422). O efeito sai sempre no formato novo, uma lista.
export function draftToContent(draft: TemplateDraft): { content: AgendaTemplateContent } | { error: string } {
    const options: AgendaTemplateContent['options'] = []
    for (const [index, option] of draft.options.entries()) {
        const n = index + 1
        if (option.key.trim() === '') return { error: `Informe a chave da opção ${n}.` }
        if (option.label.trim() === '' || option.gain.trim() === '' || option.loss.trim() === '') {
            return { error: `Preencha rótulo, ganho e perda da opção ${n}.` }
        }
        if (new Set(option.effects.map((e) => e.metric)).size !== option.effects.length) {
            return { error: `A opção ${n} não pode mexer na mesma alavanca duas vezes.` }
        }
        const effects: AgendaTemplateEffect[] = []
        for (const effect of option.effects) {
            if (effect.metric === POLICY_METRIC) {
                effects.push({ metric: effect.metric, value: effect.value })
                continue
            }
            const intensity = Number(effect.intensity.trim().replace(',', '.'))
            if (effect.intensity.trim() === '' || !Number.isFinite(intensity)) {
                return { error: `A intensidade da opção ${n} precisa ser um número entre 0 e 1.` }
            }
            effects.push({ metric: effect.metric, direction: Number(effect.direction), intensity })
        }
        options.push({
            key: option.key.trim(),
            label: option.label.trim(),
            gain: option.gain.trim(),
            loss: option.loss.trim(),
            effect: { effects },
        })
    }
    return {
        content: {
            purpose: draft.purpose,
            sector: draft.sector.trim() === '' ? null : draft.sector.trim(),
            title: draft.title.trim(),
            description: draft.description.trim(),
            options,
        },
    }
}

const PREVIEW_METRIC_LABELS = {
    growth: 'crescimento',
    quality: 'qualidade',
    payout: 'payout',
    pn_premium: 'prêmio da ação PN',
} as const

const POLICY_VALUE_LABELS: Record<string, string> = { quarterly: 'trimestral', semiannual: 'semestral', annual: 'anual' }

// Um efeito de opção como o painel o mostra: o que mexe e quanto da faixa do motor usa.
export function describeEffectPreview(effect: AdminEffectPreview): string {
    if (effect.metric === 'dividend_policy') return `política de dividendo vira ${POLICY_VALUE_LABELS[effect.value] ?? effect.value}`
    return `${PREVIEW_METRIC_LABELS[effect.metric]} ${effect.direction === 1 ? 'sobe' : 'desce'}, intensidade ${String(effect.intensity).replace('.', ',')}`
}

// Chave da pauta nova a partir do título (minúsculas, sem acento, com _). O admin pode editar.
export function suggestKey(title: string): string {
    return title
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60)
}

const SINGULAR_UNITS: Record<string, string> = {
    'dias reais': 'dia real',
    'dias simulados': 'dia simulado',
    pessoas: 'pessoa',
    apoios: 'apoio',
    propostas: 'proposta',
    votos: 'voto',
}

// A unidade de um parâmetro concordando com o número: "1 dia real", "7 dias reais".
export function unitFor(unit: string, value: number): string {
    return value === 1 ? (SINGULAR_UNITS[unit] ?? unit) : unit
}
