import type { Lesson } from '../../../services/lessons'
import type { NextUnlock } from './types'

export type { NextUnlock } from './types'

// Tarefa J.4 — nenhum lugar do app hoje mostra quanto falta pra desbloquear
// a próxima coisa fora do Mapa da Trilha (que já é a fonte da verdade, mas
// exige entrar lá pra ver). `unlocksDescription` vazio/null é o sinal de
// "essa lição não desbloqueia nada novo" (0.3, 2.1, 3.1, ...); nas 33
// lições atuais, toda vez que `unlocksKeys` tem alguma chave,
// `unlocksDescription` também está preenchido (par sempre junto, ver
// `seedLessons.ts`), então checar só a description já cobre o critério
// original ("unlocksKeys/unlocksDescription não é vazio").
// `GET /lessons` já devolve ordenado por `sortOrder` (mesma premissa de
// `trackGroups`), e a trilha é estritamente sequencial (backend:
// `lessonStatus`), então a distância até a lição-alvo é só a diferença
// entre o `sortOrder` dela e a quantidade já concluída.
export function nextUnlockFor(lessons: Lesson[]): NextUnlock | null {
    const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length
    const target = lessons.find((lesson) => lesson.status !== 'completed' && Boolean(lesson.unlocksDescription))

    if (!target) return null

    return { description: target.unlocksDescription, lessonsRemaining: target.sortOrder - completedCount }
}
