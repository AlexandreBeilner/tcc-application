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
// `GET /lessons` já devolve só as publicadas, ordenadas por `sortOrder`
// (mesma premissa de `trackGroups`), e a trilha é estritamente sequencial
// (backend: `buildProgression`), então a distância até a lição-alvo é a
// posição dela na lista menos a quantidade já satisfeita (concluída ou
// dispensada, N.24). Lição dispensada nunca é alvo: o usuário já passou dela
// e o desbloqueio dela já vale.
export function nextUnlockFor(lessons: Lesson[]): NextUnlock | null {
    const satisfiedCount = lessons.filter((lesson) => lesson.status === 'completed' || lesson.waived).length
    const targetIndex = lessons.findIndex((lesson) => lesson.status !== 'completed' && !lesson.waived && Boolean(lesson.unlocksDescription))

    if (targetIndex === -1) return null

    return { description: lessons[targetIndex].unlocksDescription, lessonsRemaining: targetIndex + 1 - satisfiedCount }
}
