import { plainLessonText } from '../parseLessonMarkup'
import { buildPhaseCards } from '../playerCards'
import { parseLessonBlocks } from '../widgets/schema'
import type { Lesson } from '../../../services/lessons'

export interface NextLessonTeaser {
    id: string
    title: string
    // Primeiro cartão de texto da próxima lição, cortado em uma linha; ausente quando ela abre com widget ou pergunta.
    excerpt?: string
}

const EXCERPT_MAX_CHARS = 110

function cut(text: string): string {
    if (text.length <= EXCERPT_MAX_CHARS) return text
    const head = text.slice(0, EXCERPT_MAX_CHARS)
    return `${head.slice(0, Math.max(head.lastIndexOf(' '), 1)).trimEnd()}…`
}

// Teaser da lição seguinte (LJ.1.4): título e uma linha do começo, para o Continuar ter um motivo. A seguinte é
// a de `sortOrder` + 1 (a mesma do botão Continuar); bloqueada não ganha teaser.
export function nextLessonTeaser(lessons: Lesson[], current: Pick<Lesson, 'sortOrder'> | undefined): NextLessonTeaser | null {
    const next = current && lessons.find((lesson) => lesson.sortOrder === current.sortOrder + 1)
    if (!next || next.status === 'locked') return null
    const first = buildPhaseCards(parseLessonBlocks(next.blocks)?.phases.scenario, next.scenarioText)[0]
    const excerpt = first?.kind === 'text' ? cut(plainLessonText(first.text)) : ''
    return { id: next.id, title: next.title, ...(excerpt ? { excerpt } : {}) }
}
