import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
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
    })
}
