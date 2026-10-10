import type { Lesson } from '../../../services/lessons'
import { isParallelTrack } from '../../../utils/tracks'
import type { LessonUnlockHint } from './types'

export type { LessonUnlockHint } from './types'

// Espelha em TS puro `backend/src/modules/lessons/domain/lesson.ts#unlockedKeysFor`
// (tarefa 7.0.1) a partir dos mesmos dados de `GET /lessons` — sem endpoint
// novo. As lições "satisfeitas" vêm de `status === 'completed'` ou `waived`
// (dispensa, N.24; já calculados pelo backend, ver `.docs/backend/lessons.md`),
// nunca recalculadas aqui. `GET /lessons` devolve só as publicadas, ordenadas
// por `sortOrder`, então a posição é o índice na lista: as chaves valem pras
// primeiras `satisfiedCount` lições.
export function unlockedKeysFor(allLessons: Lesson[]): Set<string> {
    // Trilha paralela (RC.4.4) fica fora da corrente que as chaves seguem.
    const lessons = allLessons.filter((lesson) => !isParallelTrack(lesson.trackNumber))
    const satisfiedCount = lessons.filter((lesson) => lesson.status === 'completed' || lesson.waived).length
    const keys = new Set<string>()

    for (const lesson of lessons.slice(0, satisfiedCount)) {
        for (const key of lesson.unlocksKeys) keys.add(key)
    }

    return keys
}

// Usado pelo estado travado de EquityList/FixedIncomeList (tela 4.2/4.4,
// tarefa 7.0.1) pra linkar direto pra lição que desbloqueia o produto.
// `reachable` (tarefa N.1) é falso quando a lição encontrada ainda está
// `locked` pro usuário — navegar direto pro `id` nesse caso devolveria 404
// no backend (`GetLessonUseCase`/`LessonLockedError`).
export function findLessonUnlocking(key: string, lessons: Lesson[]): LessonUnlockHint | undefined {
    const lesson = lessons.find((l) => l.unlocksKeys.includes(key))
    return lesson ? { id: lesson.id, code: lesson.code, title: lesson.title, reachable: lesson.status !== 'locked' } : undefined
}

// Único lugar que decide o destino de navegação de um hint de desbloqueio —
// consumidores (N.2/N.3) reaproveitam em vez de montar `/trilha/${hint.id}`
// na mão e arriscar apontar pra uma lição ainda inacessível.
export function safeUnlockPath(hint: LessonUnlockHint): string {
    return hint.reachable ? `/trilha/${hint.id}` : '/trilha'
}

// Espelha 1:1 o vocabulário fixo de `unlocks_keys` do backend
// (`asset:<AssetType>`) — único lugar do frontend que monta essa string.
export function assetUnlockKey(assetType: string): string {
    return `asset:${assetType}`
}
