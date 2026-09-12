import type { Lesson } from '../../../services/lessons'

export interface TrackChartPoint {
    lesson: Lesson
    x: number
    y: number
}

export interface TrackChartLayout {
    // Largura mínima real, em px, que garante o espaçamento mínimo entre
    // nós consecutivos pro nº de lições desta trilha (`trackChartWidthFor`,
    // tarefa L.1) — não tem relação com o espaço virtual de `points`
    // (sempre 0-`TRACK_CHART_WIDTH`); o componente só usa este valor como
    // `style.width` do card, deixando o CSS (`min-width: 100%`) decidir se
    // ele de fato precisa de mais espaço que o container real.
    width: number
    points: TrackChartPoint[]
    fillPath: string | null
    solidPath: string | null
    dashedPath: string | null
    currentPoint: TrackChartPoint | null
}
