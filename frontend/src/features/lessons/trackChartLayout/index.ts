import type { Lesson } from '../../../services/lessons'
import { noise } from '../../../utils/deterministicNoise'
import type { TrackChartLayout, TrackChartPoint } from './types'

export type { TrackChartLayout, TrackChartPoint } from './types'

// Unidades virtuais (não px) — o componente escala isso pra 100% do
// container via viewBox + posicionamento em porcentagem, então o mesmo
// layout serve pro card estreito do mobile e pro card largo do desktop
// (identidade-visual-padroes.md §7: desktop não é mobile esticado, mas o
// dado geométrico por trás do gráfico é o mesmo, só o container muda).
export const TRACK_CHART_WIDTH = 1000
export const TRACK_CHART_HEIGHT = 320

const MARGIN_X = TRACK_CHART_WIDTH * 0.06
const MARGIN_Y = TRACK_CHART_HEIGHT * 0.14
const WAYPOINTS_PER_SEGMENT = 3
const NOISE_AMPLITUDE_RATIO = 0.55

interface Vertex {
    x: number
    y: number
}

function anchorAt(index: number, count: number): Vertex {
    const usableW = TRACK_CHART_WIDTH - 2 * MARGIN_X
    const usableH = TRACK_CHART_HEIGHT - 2 * MARGIN_Y
    const t = count === 1 ? 0 : index / (count - 1)

    return {
        x: MARGIN_X + t * usableW,
        // y decresce conforme o índice avança — cada lição real fica acima
        // da anterior (identidade-visual-padroes.md §4: tendência de alta
        // no longo prazo é garantida nos marcos reais).
        y: MARGIN_Y + usableH - t * usableH,
    }
}

// Pontos de ruído entre dois marcos reais — mesmo trecho sobe no total,
// mas com altos e baixos no caminho (identidade-visual-padroes.md §4:
// uma reta "entrega o truque", só o ruído lê como gráfico de ativo).
function segmentWaypoints(fromIndex: number, count: number): Vertex[] {
    const from = anchorAt(fromIndex, count)
    const to = anchorAt(fromIndex + 1, count)
    const rise = from.y - to.y
    const waypoints: Vertex[] = []

    for (let step = 1; step <= WAYPOINTS_PER_SEGMENT; step++) {
        const t = step / (WAYPOINTS_PER_SEGMENT + 1)
        const baseX = from.x + (to.x - from.x) * t
        const baseY = from.y + (to.y - from.y) * t
        const wobble = (noise(fromIndex * 97 + step) - 0.5) * rise * NOISE_AMPLITUDE_RATIO
        waypoints.push({ x: baseX, y: baseY - wobble })
    }

    return waypoints
}

function pathFrom(vertices: Vertex[]): string {
    return vertices.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

// Último índice cuja lição não está bloqueada — fronteira entre "sólido,
// preenchido" (já é seu) e "tracejado, sem preenchimento" (projeção) da
// identidade-visual-padroes.md §3. -1 quando a trilha inteira ainda está
// bloqueada.
function findBoundaryIndex(lessons: Lesson[]): number {
    let boundary = -1
    for (let index = 0; index < lessons.length; index++) {
        if (lessons[index].status !== 'locked') boundary = index
    }
    return boundary
}

export function computeTrackChartLayout(lessons: Lesson[]): TrackChartLayout | null {
    if (lessons.length < 2) return null

    const count = lessons.length
    const points: TrackChartPoint[] = lessons.map((lesson, index) => ({ lesson, ...anchorAt(index, count) }))

    const allVertices: Vertex[] = [points[0]]
    for (let index = 0; index < count - 1; index++) {
        allVertices.push(...segmentWaypoints(index, count), points[index + 1])
    }

    const boundaryIndex = findBoundaryIndex(lessons)
    const boundaryVertexIndex = boundaryIndex < 0 ? -1 : boundaryIndex * (WAYPOINTS_PER_SEGMENT + 1)

    const solidVertices = boundaryVertexIndex >= 0 ? allVertices.slice(0, boundaryVertexIndex + 1) : []
    const dashedVertices = boundaryVertexIndex >= 0 ? allVertices.slice(boundaryVertexIndex) : allVertices

    const baselineY = TRACK_CHART_HEIGHT - MARGIN_Y * 0.3
    const fillPath =
        solidVertices.length > 1
            ? `${pathFrom(solidVertices)} L${solidVertices[solidVertices.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} L${solidVertices[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`
            : null

    return {
        points,
        fillPath,
        solidPath: solidVertices.length > 1 ? pathFrom(solidVertices) : null,
        dashedPath: dashedVertices.length > 1 ? pathFrom(dashedVertices) : null,
        currentPoint: points.find((point) => point.lesson.status === 'available') ?? null,
    }
}
