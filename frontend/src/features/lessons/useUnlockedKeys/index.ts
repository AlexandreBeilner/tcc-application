import { useMemo } from 'react'
import type { Lesson } from '../../../services/lessons'
import { unlockedKeysFor } from '../unlockedKeys'
import { useLessonsQuery } from '../useLessonsQuery'

export interface UseUnlockedKeysResult {
    unlockedKeys: Set<string>
    lessons: Lesson[]
    isLoading: boolean
}

// Consumido pelo gate de navegação (AppShell/TabBar, telas Portfólio/
// Calculadora) e pelo estado travado de EquityList/FixedIncomeList (tarefa
// 7.0.1) — uma única leitura de `GET /lessons` (cache do TanStack Query já
// compartilhada com o Mapa da Trilha) por trás de todos os consumidores.
export function useUnlockedKeys(): UseUnlockedKeysResult {
    const lessonsQuery = useLessonsQuery()
    const lessons = useMemo(() => lessonsQuery.data?.lessons ?? [], [lessonsQuery.data])
    const unlockedKeys = useMemo(() => unlockedKeysFor(lessons), [lessons])

    return { unlockedKeys, lessons, isLoading: lessonsQuery.isLoading }
}
