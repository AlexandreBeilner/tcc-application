import type { Lesson } from '../../../services/lessons'
import { noise } from '../../../utils/deterministicNoise'
import type { TrackChartLayout, TrackChartPoint } from './types'

export type { TrackChartLayout, TrackChartPoint } from './types'

// Unidades virtuais (não px) — todo o cálculo de âncora/curva usa este
// espaço fixo, e o componente usa a MESMA proporção (viewBox + aspect-ratio
// CSS, ambos `TRACK_CHART_WIDTH`/`TRACK_CHART_HEIGHT`) pra nunca distorcer
// a curva/grade de fundo, seja qual for o tamanho real do card. O
// espaçamento mínimo real em px entre nós (tarefa L.1, `trackChartWidthFor`
// abaixo) é um cálculo separado, que não participa deste espaço virtual —
// só informa a largura real (`style.width`) que o componente força no
// `.chart`, deixando a MESMA posição percentual de sempre virar mais px
// reais quando o card cresce.
export const TRACK_CHART_WIDTH = 1000
export const TRACK_CHART_HEIGHT = 320

const MARGIN_X = TRACK_CHART_WIDTH * 0.06
const MARGIN_Y = TRACK_CHART_HEIGHT * 0.14
const WAYPOINTS_PER_SEGMENT = 3
const NOISE_AMPLITUDE_RATIO = 0.55
// Mínimo real entre dois nós consecutivos, em px — folgado em relação ao
// maior diâmetro de nó hoje (48px em desktop, `TrackChart/index.module.css`),
// mas calibrado pra ainda caber sem rolagem as trilhas pequenas do currículo
// real (4-5 lições, trilhas 0/3 do seed) no card mais estreito (mobile,
// `pages/Track/index.module.css`).
const MIN_NODE_SPACING = 70

interface Vertex {
    x: number
    y: number
}

// Largura real mínima (px) que garante `MIN_NODE_SPACING` de respiro entre
// nós consecutivos pro nº de lições da trilha (tarefa L.1) — achado de
// auditoria: trilha 2 do seed real tem 15 lições espremidas num único card
// de largura fixa, já que hoje o espaçamento é só `100%/(count-1)`, que
// encolhe pra sempre caber. Cada nó ocupa a MESMA fração (%) da largura do
// card nos dois casos (aqui e em `anchorAt`) — só forçar o card a ser real-
// mente mais largo (via `style.width` em `TrackChart`, com `min-width: 100%`
// garantindo que isso nunca ENCOLHE o card de uma trilha pequena) já
// traduz essa mesma fração em mais px reais, sem tocar no espaço virtual
// usado por `anchorAt`/viewBox.
export function trackChartWidthFor(count: number): number {
    if (count <= 1) return MIN_NODE_SPACING

    const usableRatio = 1 - (2 * MARGIN_X) / TRACK_CHART_WIDTH
    return (MIN_NODE_SPACING * (count - 1)) / usableRatio
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
        width: trackChartWidthFor(count),
        points,
        fillPath,
        solidPath: solidVertices.length > 1 ? pathFrom(solidVertices) : null,
        dashedPath: dashedVertices.length > 1 ? pathFrom(dashedVertices) : null,
        currentPoint: points.find((point) => point.lesson.status === 'available') ?? null,
    }
}
