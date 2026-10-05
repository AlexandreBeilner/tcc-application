import type { BotAssetRef } from '../../../services/admin'

export interface BotCoverageEditorProps {
    // Ativos que o Market Maker pode ter: os que ele já cobre mais os sem cobertura ativa.
    options: BotAssetRef[]
    selected: string[]
    onSelectedChange: (selected: string[]) => void
    maxCovered: string
    onMaxCoveredChange: (value: string) => void
    // Erro do teto (vazio ou menor que a seleção), mostrado sob o campo.
    maxError?: string | null
}
