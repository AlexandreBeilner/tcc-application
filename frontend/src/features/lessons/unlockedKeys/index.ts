import type { Lesson } from '../../../services/lessons'
import type { LessonUnlockHint } from './types'

export type { LessonUnlockHint } from './types'

// Espelha em TS puro `backend/src/modules/lessons/domain/lesson.ts#unlockedKeysFor`
// (tarefa 7.0.1) a partir dos mesmos dados de `GET /lessons` — sem endpoint
// novo. `completedCount` vem de `status === 'completed'` (já calculado pelo
// backend, ver `.docs/backend/lessons.md`), nunca recalculado aqui — só a
// união de `unlocksKeys` é responsabilidade deste módulo.
export function unlockedKeysFor(lessons: Lesson[]): Set<string> {
    const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length
    const keys = new Set<string>()

    for (const lesson of lessons) {
        if (lesson.sortOrder <= completedCount) {
            for (const key of lesson.unlocksKeys) keys.add(key)
        }
    }

    return keys
}

// Usado pelo estado travado de EquityList/FixedIncomeList (tela 4.2/4.4,
// tarefa 7.0.1) pra linkar direto pra lição que desbloqueia o produto.
export function findLessonUnlocking(key: string, lessons: Lesson[]): LessonUnlockHint | undefined {
    const lesson = lessons.find((l) => l.unlocksKeys.includes(key))
    return lesson ? { id: lesson.id, code: lesson.code, title: lesson.title } : undefined
}

// Espelha 1:1 o vocabulário fixo de `unlocks_keys` do backend
// (`asset:<AssetType>`) — único lugar do frontend que monta essa string.
export function assetUnlockKey(assetType: string): string {
    return `asset:${assetType}`
}
