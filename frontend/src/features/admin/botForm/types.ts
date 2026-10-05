import type { BotArchetype } from '../../../services/admin'

// Valores do formulário de criação como texto digitado. Percentuais ficam em porcentagem
// (90 para 90%), como o admin pensa; `toCreateInput` converte para fração, como o motor guarda.
export interface BotFormValues {
    archetype: BotArchetype
    sectors: string[]
    riskClasses: string[]
    assetClasses: string[]
    withinScopePct: string
    knowledgeLevelPct: string
    maxPositionSizePct: string
    marketOrderPreferencePct: string
    spreadWidthPct: string
    maxCoveredAssets: string
    initialCash: string
}

export type BotFormErrors = Partial<Record<keyof BotFormValues, string>>
