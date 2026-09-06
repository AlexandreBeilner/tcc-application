import { useMemo } from 'react'
import type { Lesson } from '../../../services/lessons'
import { unlockedKeysFor } from '../unlockedKeys'
import { useLessonsQuery } from '../useLessonsQuery'

export interface UseUnlockedKeysResult {
    unlockedKeys: Set<string>
    lessons: Lesson[]
    isLoading: boolean
    isError: boolean
}

// Consumido pelo gate de navegação (AppShell/TabBar, telas Portfólio/
// Calculadora) e pelo estado travado de EquityList/FixedIncomeList (tarefa
// 7.0.1) — uma única leitura de `GET /lessons` (cache do TanStack Query já
// compartilhada com o Mapa da Trilha) por trás de todos os consumidores.
// `isError` (revisão da Semana 7) é distinto de "nada desbloqueado":
// `unlockedKeys` some vazio tanto em loading quanto em erro, e um
// consumidor que não checar `isError` trataria uma falha transitória do
// GET como se o usuário não tivesse desbloqueado nada.
export function useUnlockedKeys(): UseUnlockedKeysResult {
    const lessonsQuery = useLessonsQuery()
    const lessons = useMemo(() => lessonsQuery.data?.lessons ?? [], [lessonsQuery.data])
    const unlockedKeys = useMemo(() => unlockedKeysFor(lessons), [lessons])

    return { unlockedKeys, lessons, isLoading: lessonsQuery.isLoading, isError: lessonsQuery.isError }
}
