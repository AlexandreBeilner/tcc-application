import type {
    AssemblyDetail,
    AssemblyEffectPreview,
    AssemblyOption,
    AssemblySummary,
    DividendPolicyValue,
    VoteDenialReason,
} from '../../../services/assemblies'

const DAY_MS = 24 * 60 * 60 * 1000

function intensityWord(intensity: number): string {
    if (intensity <= 0.4) return 'leve'
    if (intensity <= 0.7) return 'moderada'
    return 'forte'
}

const POLICY_PHRASES: Record<DividendPolicyValue, string> = {
    quarterly: 'passa a pagar dividendo a cada trimestre',
    semiannual: 'passa a pagar dividendo a cada semestre',
    annual: 'passa a pagar dividendo uma vez por ano',
}

export const DIVIDEND_POLICY_LABELS: Record<DividendPolicyValue, string> = {
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
}

const TARGETS: Record<'growth' | 'quality' | 'payout' | 'pn_premium', string> = {
    growth: 'o ritmo de crescimento da empresa',
    quality: 'a qualidade da operação (margem e alavancagem)',
    payout: 'a parte do lucro que a empresa distribui como dividendo',
    pn_premium: 'o dividendo extra da ação PN em relação à ON',
}

// O que um efeito da opção mexe, sem veredito: nunca diz qual lado é melhor e nunca cita valor. O
// tamanho final é do motor; aqui só aparece a fração da faixa dele que a opção usa.
export function describeEffect(effect: AssemblyEffectPreview | null): string | null {
    if (!effect) return null
    if (effect.metric === 'dividend_policy') return `A empresa ${POLICY_PHRASES[effect.value]}.`
    const verb = effect.direction === 1 ? 'Empurra para cima' : 'Empurra para baixo'
    return `${verb} ${TARGETS[effect.metric]}, com força ${intensityWord(effect.intensity)}.`
}

// Todos os efeitos da opção, na ordem da pauta e com o mesmo peso (nenhum é o principal). Opção de
// uma assembleia anterior à lista de efeitos cai no efeito único.
export function describeEffects(option: Pick<AssemblyOption, 'effect' | 'effects'>): string[] {
    const effects = option.effects?.length ? option.effects : option.effect ? [option.effect] : []
    return effects.map((e) => describeEffect(e)).filter((text): text is string => text !== null)
}

// Prazo em linguagem de calendário: "fecha em 3 dias", "fecha hoje", "encerrada".
export function closesLabel(closesAt: string, now: Date = new Date()): string {
    const ms = new Date(closesAt).getTime() - now.getTime()
    if (ms <= 0) return 'Votação encerrada'
    const days = Math.ceil(ms / DAY_MS)
    if (days <= 1) return 'Fecha em menos de 1 dia'
    return `Fecha em ${days} dias`
}

export function resultHeadline(detail: AssemblyDetail): string | null {
    const { result, options, minVoters } = detail
    if (!result) return null
    if (result.outcome === 'approved') {
        const winner = options.find((o) => o.id === result.winningOptionId)
        return winner ? `Aprovada: ${winner.label}` : 'Aprovada'
    }
    if (result.reason === 'quorum') return `Não houve votantes suficientes (o mínimo é ${minVoters}). Nada muda.`
    return 'Empate entre as opções. Nada muda.'
}

export function outcomeBadge(assembly: Pick<AssemblySummary, 'status' | 'outcome' | 'outcomeReason'>): string {
    if (assembly.status === 'open') return 'Votação aberta'
    if (assembly.outcome === 'approved') return 'Aprovada'
    return assembly.outcomeReason === 'quorum' ? 'Sem votantes suficientes' : 'Empate'
}

// Convite ao PRO só para quem ficou sem como votar por falta de crédito (nunca no lugar do voto).
export function isCreditShortage(reason: VoteDenialReason | null): boolean {
    return reason === 'no_credit'
}

const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
export const formatShortDate = (iso: string) => dayFormatter.format(new Date(iso))

export const percentLabel = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
