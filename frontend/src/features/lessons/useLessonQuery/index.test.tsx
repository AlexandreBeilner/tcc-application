import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../services/client'
import { getLesson } from '../../../services/lessons'
import { useLessonQuery } from './index'

vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ token: 'tok' }) }))
vi.mock('../../../services/lessons', () => ({ getLesson: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient()
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useLessonQuery', () => {
    it('não repete a chamada quando a lição é 404 (bloqueada ou inexistente)', async () => {
        vi.mocked(getLesson).mockReset()
        vi.mocked(getLesson).mockRejectedValue(new ApiError(404, 'lição bloqueada'))

        const { result } = renderHook(() => useLessonQuery('lesson-1'), { wrapper })

        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 500 })
        expect(getLesson).toHaveBeenCalledTimes(1)
    })
})
