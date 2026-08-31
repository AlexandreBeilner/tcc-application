import { noise } from '../../../utils/deterministicNoise'

export const PODIUM_SPARKLINE_WIDTH = 112
export const PODIUM_SPARKLINE_HEIGHT = 40

const MARGIN_Y = 4
const WAYPOINTS = 5
const TOTAL_POINTS = WAYPOINTS + 2

// Mesmo princípio de `features/lessons/trackChartLayout` (Mapa da Trilha,
// 6.4/identidade-visual-padroes.md §4): a linha de progressão nunca é uma
// reta, mesmo com só 2 marcos reais (início da janela = 0%, agora =
// `endPct`) — ruído determinístico entre eles é o que faz a leitura ser
// "gráfico de ativo", não "barra de progresso disfarçada". Hash simples
// (não `Math.random`) — o mesmo `seedKey` sempre produz o mesmo desenho,
// senão o pódio "tremeria" a cada re-render.
function hashSeed(seed: string): number {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

export interface PodiumSparkline {
    linePath: string
    fillPath: string
}

// `seedKey` deve identificar o usuário e o critério ativo (ex:
// `${userId}:${criterion}`) — trocar de critério troca o formato do
// ruído, evitando que dois critérios com o mesmo `endPct` (coincidência)
// desenhem exatamente a mesma linha.
export function computePodiumSparkline(seedKey: string, endPct: number): PodiumSparkline {
    const baseSeed = hashSeed(seedKey)
    // Escala do ruído (amplitude/range) parte do tamanho real do movimento,
    // com um piso de 4 pontos percentuais pra uma linha "achatada" perto de
    // 0% ainda mostrar alguma textura — nunca maior que o próprio
    // movimento, senão o ruído dominaria a tendência real.
    const noiseBase = Math.max(Math.abs(endPct), 4)
    const amplitude = noiseBase * 0.35
    const range = noiseBase * 1.3
    const usableH = PODIUM_SPARKLINE_HEIGHT - 2 * MARGIN_Y

    function valueToY(value: number): number {
        const t = (value + range) / (2 * range) // 0 = pior, 1 = melhor
        return MARGIN_Y + usableH * (1 - t)
    }

    const points: { x: number; y: number }[] = []
    for (let i = 0; i < TOTAL_POINTS; i++) {
        const t = i / (TOTAL_POINTS - 1)
        const isAnchor = i === 0 || i === TOTAL_POINTS - 1
        const trendValue = endPct * t
        const wobble = isAnchor ? 0 : (noise(baseSeed + i * 13) - 0.5) * amplitude
        points.push({ x: t * PODIUM_SPARKLINE_WIDTH, y: valueToY(trendValue + wobble) })
    }

    const linePath = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
    const fillPath = `${linePath} L${PODIUM_SPARKLINE_WIDTH},${PODIUM_SPARKLINE_HEIGHT} L0,${PODIUM_SPARKLINE_HEIGHT} Z`

    return { linePath, fillPath }
}
