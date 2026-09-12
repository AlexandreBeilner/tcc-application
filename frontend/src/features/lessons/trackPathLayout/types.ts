import type { Lesson } from '../../../services/lessons'

export interface TrackPathPoint {
    lesson: Lesson
    x: number
    y: number
}

export interface TrackPathLayout {
    // Altura total do canvas virtual, em unidades — cresce linearmente com
    // o nº de lições (`MARGIN_Y * 2 + (count - 1) * NODE_STEP_HEIGHT`), ao
    // contrário de `TRACK_CHART_WIDTH` (fixo). A página rola na vertical
    // nativamente, então não existe aqui o equivalente de `trackChartWidthFor`
    // (tarefa L.1) — nenhuma conversão pra px real é necessária, o
    // consumidor (O.3) usa este valor direto como altura do SVG.
    height: number
    points: TrackPathPoint[]
    solidPath: string | null
    dashedPath: string | null
    currentPoint: TrackPathPoint | null
}
