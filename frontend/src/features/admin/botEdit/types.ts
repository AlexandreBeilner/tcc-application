// Valores do formulário de edição da personalidade como texto digitado (N.15). Percentuais em
// porcentagem (90 para 90%); `toUpdateInput` converte para fração. A preferência por ordem a
// mercado não entra: o campo é reservado e sem efeito (achado 001).
export interface BotEditValues {
    sectors: string[]
    riskClasses: string[]
    assetClasses: string[]
    withinScopePct: string
    knowledgeLevelPct: string
    maxPositionSizePct: string
    spreadWidthPct: string
}

export type BotEditErrors = Partial<Record<keyof BotEditValues, string>>
