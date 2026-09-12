import type { Lesson } from '../../../services/lessons'
import { noise } from '../../../utils/deterministicNoise'
import type { TrackPathLayout, TrackPathPoint } from './types'

export type { TrackPathLayout, TrackPathPoint } from './types'

// Mesmo espaço virtual (não px) de `trackChartLayout`, eixo trocado: aqui é
// a ALTURA que cresce com o índice (progressão sequencial das lições), não
// a largura — a largura do canvas fica fixa e só o zigue-zague varia dentro
// dela. A página rola na vertical nativamente, então não existe aqui o
// equivalente de `trackChartWidthFor` (tarefa L.1, "espaço fixo que precisa
// forçar largura mínima") — decisão documentada, não uma lacuna.
export const TRACK_PATH_WIDTH = 300

const MARGIN_X = 60
const MARGIN_Y = 60
const NODE_STEP_HEIGHT = 220
const WAYPOINTS_PER_SEGMENT = 3
const NOISE_AMPLITUDE_RATIO = 0.4

// Zigue-zague de período curto fixado no mockup O.0 — centro → direita →
// centro → esquerda, repetindo. Nunca um desenho aleatório novo por
// trilha: leitura previsível em qualquer contagem de lições real do
// currículo (4 a 15).
const ZIGZAG_PATTERN = [0, 1, 0, -1]

interface Vertex {
    x: number
    y: number
}

function zigzagOffset(index: number): number {
    return ZIGZAG_PATTERN[index % ZIGZAG_PATTERN.length]
}

function anchorAt(index: number): Vertex {
    const centerX = TRACK_PATH_WIDTH / 2
    const usableHalfWidth = centerX - MARGIN_X

    return {
        x: centerX + zigzagOffset(index) * usableHalfWidth,
        // y cresce com o índice — a primeira lição fica no topo, a
        // progressão desce a página no mesmo sentido em que ela rola,
        // qualquer tamanho de tela.
        y: MARGIN_Y + index * NODE_STEP_HEIGHT,
    }
}

// Pontos de ruído entre dois marcos reais — mesmo princípio de
// `trackChartLayout` (identidade-visual-padroes.md §4: nunca uma reta),
// eixo trocado: o wobble entra no x (perpendicular à progressão vertical),
// não no y.
function segmentWaypoints(fromIndex: number): Vertex[] {
    const from = anchorAt(fromIndex)
    const to = anchorAt(fromIndex + 1)
    const run = to.x - from.x
    const waypoints: Vertex[] = []

    for (let step = 1; step <= WAYPOINTS_PER_SEGMENT; step++) {
        const t = step / (WAYPOINTS_PER_SEGMENT + 1)
        const baseX = from.x + run * t
        const baseY = from.y + (to.y - from.y) * t
        const wobble = (noise(fromIndex * 97 + step) - 0.5) * run * NOISE_AMPLITUDE_RATIO
        waypoints.push({ x: baseX + wobble, y: baseY })
    }

    return waypoints
}

function pathFrom(vertices: Vertex[]): string {
    return vertices.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

// Último índice cuja lição não está bloqueada — mesma fronteira sólido/
// tracejado de `trackChartLayout`/`findBoundaryIndex`
// (identidade-visual-padroes.md §3), duplicada aqui (função pura de 6
// linhas): os 2 módulos geram paths de trilhas diferentes (horizontal vs.
// vertical) e não compartilham mais nenhuma outra regra.
function findBoundaryIndex(lessons: Lesson[]): number {
    let boundary = -1
    for (let index = 0; index < lessons.length; index++) {
        if (lessons[index].status !== 'locked') boundary = index
    }
    return boundary
}

export function computeTrackPathLayout(lessons: Lesson[]): TrackPathLayout | null {
    if (lessons.length < 2) return null

    const count = lessons.length
    const points: TrackPathPoint[] = lessons.map((lesson, index) => ({ lesson, ...anchorAt(index) }))

    const allVertices: Vertex[] = [points[0]]
    for (let index = 0; index < count - 1; index++) {
        allVertices.push(...segmentWaypoints(index), points[index + 1])
    }

    const boundaryIndex = findBoundaryIndex(lessons)
    const boundaryVertexIndex = boundaryIndex < 0 ? -1 : boundaryIndex * (WAYPOINTS_PER_SEGMENT + 1)

    const solidVertices = boundaryVertexIndex >= 0 ? allVertices.slice(0, boundaryVertexIndex + 1) : []
    const dashedVertices = boundaryVertexIndex >= 0 ? allVertices.slice(boundaryVertexIndex) : allVertices

    return {
        height: MARGIN_Y * 2 + (count - 1) * NODE_STEP_HEIGHT,
        points,
        solidPath: solidVertices.length > 1 ? pathFrom(solidVertices) : null,
        dashedPath: dashedVertices.length > 1 ? pathFrom(dashedVertices) : null,
        currentPoint: points.find((point) => point.lesson.status === 'available') ?? null,
    }
}
