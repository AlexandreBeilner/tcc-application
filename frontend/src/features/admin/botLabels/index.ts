import type { AdminBot, BotArchetype } from '../../../services/admin'

// Rótulos dos valores do motor (arquétipo, setor, classe de risco e de ativo). Os setores e
// as classes de risco chegam do motor já como texto de exibição; as classes de ativo e o
// arquétipo são códigos.
export const ARCHETYPE_LABELS: Record<BotArchetype, string> = {
    ruido: 'Ruído',
    market_maker: 'Market Maker',
    chartista: 'Chartista',
    fundamentalista: 'Fundamentalista',
}

export const ARCHETYPES: BotArchetype[] = ['ruido', 'market_maker', 'chartista', 'fundamentalista']

// Os 6 setores fixos da spec 3.3.2, com o mesmo texto que o motor usa como valor.
export const BOT_SECTORS = ['Mineração', 'Agronegócio', 'Bancário/Financeiro', 'Varejo', 'Energia', 'Tecnologia'] as const

export const BOT_RISK_CLASSES = ['Conservador', 'Sofisticado'] as const

export const ASSET_CLASS_LABELS: Record<string, string> = {
    acao: 'Ações',
    etf: 'ETFs',
    fii: 'FIIs',
}

export const BOT_ASSET_CLASSES = ['acao', 'etf', 'fii'] as const

export function describeArchetype(archetype: string): string {
    return ARCHETYPE_LABELS[archetype as BotArchetype] ?? archetype
}

// Escopo em uma linha: "Varejo, Energia, FIIs, 90% da atividade". O percentual é a fatia da
// atividade que o bot concentra no escopo; o resto vai pra fora dele.
export function describeScope(scope: AdminBot['scope']): string {
    const parts = [
        ...scope.sectors,
        ...scope.risk_classes.map((risk) => `risco ${risk.toLowerCase()}`),
        ...scope.asset_classes.map((cls) => ASSET_CLASS_LABELS[cls] ?? cls),
    ]
    return `${parts.join(', ')}, ${formatPercent(scope.within_scope_pct)} da atividade`
}

// Fração (0 a 1) em porcentagem sem casas inúteis: 0.875 vira "87,5%", 0.9 vira "90%".
export function formatPercent(ratio: number): string {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(ratio * 100)}%`
}

// Id curto do bot: os 6 últimos caracteres. Os ids dos bots do seed são sequenciais e só
// diferem no fim, então o início ("00000000") não distinguiria ninguém.
export function shortBotId(accountId: string): string {
    return accountId.slice(-6)
}
