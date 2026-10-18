import type { EstimateUnit } from '../widgets/schema'

export type EstimateBand = 'exact' | 'close' | 'far'

export interface EstimateRange {
    min: number
    max: number
    step: number
}

// Valor da estimativa como a pessoa lê (LJ.2.2): R$ 3.100, 7,5%, 20 anos. Reais inteiros ficam sem
// centavos; o valor real, que pode ser fracionário (R$ 6.727,50), mostra os dois.
export function formatEstimateValue(value: number, unit: EstimateUnit): string {
    switch (unit) {
        case 'brl':
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
                maximumFractionDigits: 2,
            }).format(value)
        case 'pct':
            return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`
        case 'years':
            return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} ${value === 1 ? 'ano' : 'anos'}`
        case 'none':
            return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
    }
}

// Posição de um valor na régua, em % da largura (0 a 100), presa às pontas.
export function scalePosition(value: number, { min, max }: EstimateRange): number {
    if (max <= min) return 0
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

// Mantém o valor dentro da régua e alinhado ao passo (a partir de `min`), sem ruído de ponto flutuante.
export function snapToRange(value: number, { min, max, step }: EstimateRange): number {
    const clamped = Math.min(max, Math.max(min, value))
    const snapped = min + Math.round((clamped - min) / step) * step
    const decimals = (String(step).split('.')[1] ?? '').length
    return Math.min(max, Number(snapped.toFixed(decimals)))
}

// Teclado do controle: setas mudam por `step` (o `input range` já faz), PageUp/PageDown por 10 passos.
export function stepByKey(value: number, key: string, range: EstimateRange): number | undefined {
    const jump = 10 * range.step
    if (key === 'PageUp') return snapToRange(value + jump, range)
    if (key === 'PageDown') return snapToRange(value - jump, range)
    return undefined
}

// Texto digitado no campo numérico: aceita vírgula decimal; fora da régua ou ilegível é inválido.
export function parseEstimateInput(text: string, { min, max }: EstimateRange): number | undefined {
    const normalized = text.trim().replace(/\./g, '').replace(',', '.')
    if (normalized === '') return undefined
    const parsed = Number(normalized)
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}

// Frase pela distância (LJ.2.2): longe nunca é "erro", é descoberta.
export function estimateMessage(band: EstimateBand): string {
    if (band === 'exact') return 'Na mosca!'
    if (band === 'close') return 'Quase lá'
    return 'Bem diferente do que parece, né?'
}
