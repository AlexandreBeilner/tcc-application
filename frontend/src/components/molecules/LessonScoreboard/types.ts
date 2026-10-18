import type { MarkerState } from '../../../features/lessons/lessonProgress'

export interface LessonScoreboardProps {
    // Um estado por pergunta da lição, na ordem.
    states: MarkerState[]
    // Frase do placar, ex.: "4 de 5 de primeira".
    summary: string
}
