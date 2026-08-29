import { apiRequest } from '../client'
import type { ListLessonsResult } from './types'

export type { Lesson, ListLessonsResult } from './types'

export function listLessons(token: string): Promise<ListLessonsResult> {
    return apiRequest<ListLessonsResult>('/lessons', { token })
}
