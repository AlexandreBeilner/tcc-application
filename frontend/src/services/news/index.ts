import { apiRequest } from '../client'
import type { ListNewsResult } from './types'

export type { NewsEvent, ListNewsResult } from './types'

export function listNews(token: string): Promise<ListNewsResult> {
    return apiRequest<ListNewsResult>('/news', { token })
}
