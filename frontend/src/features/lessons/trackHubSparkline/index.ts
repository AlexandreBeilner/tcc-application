import { noise } from '../../../utils/deterministicNoise'
import type { TrackHubSparkline } from './types'

export type { TrackHubSparkline } from './types'

export const TRACK_HUB_SPARKLINE_WIDTH = 240
export const TRACK_HUB_SPARKLINE_HEIGHT = 30

const MARGIN_Y = 3
const WAYPOINTS = 6
const TOTAL_POINTS = WAYPOINTS + 2

// Sparkline pequena do card de trilha no Hub (tarefa O.1) — mesmo princípio
// de ruído determinístico do motor de layout do Mapa da Trilha
// (`trackPathLayout`)/`podiumSparkline` (Classificação), mas função própria:
// escala (0-100% concluído) e tamanho (240x30, card pequeno) são diferentes
// demais dos outros dois pra forçar uma API única. 2 âncoras reais (0% no
// início da trilha, `completionPct` agora), ruído entre elas — nunca uma
// reta (identidade-visual-padroes.md §4).
export function computeTrackHubSparkline(trackNumber: number, completionPct: number): TrackHubSparkline {
    const usableH = TRACK_HUB_SPARKLINE_HEIGHT - 2 * MARGIN_Y
    // Piso de 8 pontos pra uma trilha recém-começada (completionPct baixo)
    // ainda mostrar alguma textura, sem o ruído dominar a tendência real.
    const amplitude = Math.max(completionPct, 8) * 0.4

    function valueToY(value: number): number {
        const clamped = Math.max(0, Math.min(100, value))
        return MARGIN_Y + usableH * (1 - clamped / 100)
    }

    const points: { x: number; y: number }[] = []
    for (let i = 0; i < TOTAL_POINTS; i++) {
        const t = i / (TOTAL_POINTS - 1)
        const isAnchor = i === 0 || i === TOTAL_POINTS - 1
        const trendValue = completionPct * t
        const wobble = isAnchor ? 0 : (noise(trackNumber * 41 + i * 17) - 0.5) * amplitude
        points.push({ x: t * TRACK_HUB_SPARKLINE_WIDTH, y: valueToY(trendValue + wobble) })
    }

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
    const fillPath = `${linePath} L${TRACK_HUB_SPARKLINE_WIDTH},${TRACK_HUB_SPARKLINE_HEIGHT} L0,${TRACK_HUB_SPARKLINE_HEIGHT} Z`

    return { linePath, fillPath }
}
