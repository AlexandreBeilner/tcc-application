import type { AssemblyDetail, AssemblyEffectPreview, AssemblySummary, VoteDenialReason } from '../../../services/assemblies'

const DAY_MS = 24 * 60 * 60 * 1000

function intensityWord(intensity: number): string {
    if (intensity <= 0.4) return 'leve'
    if (intensity <= 0.7) return 'moderada'
    return 'forte'
}

// O que a opção mexe, sem veredito: nunca diz qual lado é melhor e nunca cita valor. O tamanho
// final é do motor; aqui só aparece a fração da faixa dele que a opção usa.
export function describeEffect(effect: AssemblyEffectPreview | null): string | null {
    if (!effect) return null
    const target = effect.metric === 'growth' ? 'o ritmo de crescimento da empresa' : 'a qualidade da operação (margem e alavancagem)'
    const verb = effect.direction === 1 ? 'Empurra para cima' : 'Empurra para baixo'
    return `${verb} ${target}, com força ${intensityWord(effect.intensity)}.`
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
