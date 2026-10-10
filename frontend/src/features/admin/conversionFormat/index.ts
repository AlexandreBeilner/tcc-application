import type { FunnelSource } from '../../../services/billing'

export const SOURCE_LABELS: Record<FunnelSource, string> = {
    league: 'Ligas',
    duel: 'Duelos',
    cosmetics: 'Identidade (selo, moldura, título)',
    retrospective: 'Retrospectiva',
    direct: 'Direto em /planos',
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Receita estimada do painel: centavos vindos da configuração do backend, `null` sem configurar.
export function formatCents(cents: number | null): string {
    return cents === null ? '—' : moneyFormatter.format(cents / 100)
}

const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 1 })

// Taxa de 0 a 1; `null` quando não há base para calcular.
export function formatRate(rate: number | null): string {
    return rate === null ? '—' : percentFormatter.format(rate)
}
