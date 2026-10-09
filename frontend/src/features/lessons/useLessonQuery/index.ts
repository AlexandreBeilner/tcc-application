import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../../services/client'
import { getLesson } from '../../../services/lessons'
import type { GetLessonResult } from '../../../services/lessons'

export function lessonQueryKey(lessonId: string) {
    return ['lessons', lessonId] as const
}

export function useLessonQuery(lessonId: string): UseQueryResult<GetLessonResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: lessonQueryKey(lessonId),
        queryFn: () => getLesson(token as string, lessonId),
        enabled: token !== null,
        // 404 é a resposta definitiva pra lição bloqueada ou inexistente (o
        // backend não distingue de propósito): repetir só deixa o "Carregando"
        // na tela por segundos antes do aviso. Falha transitória segue com os
        // 3 retries padrão.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 3,
    })
}
