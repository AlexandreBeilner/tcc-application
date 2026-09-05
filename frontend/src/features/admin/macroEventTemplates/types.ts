import type { MacroEventDirection, MacroEventMagnitudeBand } from '../../../services/admin'

export interface MacroEventTemplate {
    key: string
    title: string
    narrative: string
    category: string
    direction: MacroEventDirection
    band: MacroEventMagnitudeBand
    affectsPrice: boolean
    affectsFundamentals: boolean
}
