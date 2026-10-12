import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { useProEntry } from '.'

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn() }))

const FREE: BillingStatus = {
    isPro: false,
    state: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    willRenew: false,
    managementUrl: null,
    billingEnabled: true,
}

function entryFor(billing: Partial<BillingStatus>) {
    vi.mocked(useAuth).mockReturnValue({ token: 't' } as ReturnType<typeof useAuth>)
    vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, ...billing })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return renderHook(() => useProEntry(), { wrapper })
}

describe('useProEntry (MO.9.8)', () => {
    afterEach(() => vi.clearAllMocks())

    it('assinante, visitante, cobrança desligada e carregando', async () => {
        const subscriber = entryFor({ isPro: true, state: 'active' })
        expect(subscriber.result.current).toBeNull()
        await waitFor(() => expect(subscriber.result.current).toBe('subscriber'))

        const visitor = entryFor({})
        await waitFor(() => expect(visitor.result.current).toBe('visitor'))

        const off = entryFor({ billingEnabled: false })
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalledTimes(3))
        expect(off.result.current).toBeNull()
    })
})
