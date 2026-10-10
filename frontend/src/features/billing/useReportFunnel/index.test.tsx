import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/AuthContext'
import { reportFunnelEvent } from '../../../services/billing'
import { resetReportedFunnel, useReportFunnel } from '.'

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ reportFunnelEvent: vi.fn() }))

function setup(token: string | null = 't') {
    vi.mocked(useAuth).mockReturnValue({ token } as ReturnType<typeof useAuth>)
    return renderHook(() => useReportFunnel()).result.current
}

describe('useReportFunnel (MO.7.1)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetReportedFunnel()
        vi.mocked(reportFunnelEvent).mockResolvedValue(undefined)
    })

    it('manda o passo com a sessão e só uma vez por evento e origem na visita', () => {
        const report = setup()
        report({ event: 'invite_viewed', source: 'league' })
        report({ event: 'invite_viewed', source: 'league' })
        report({ event: 'invite_viewed', source: 'duel' })

        expect(reportFunnelEvent).toHaveBeenCalledTimes(2)
        expect(reportFunnelEvent).toHaveBeenCalledWith('t', { event: 'invite_viewed', source: 'league' })
    })

    it('sem sessão não faz nada', () => {
        setup(null)({ event: 'plans_opened', source: 'direct' })
        expect(reportFunnelEvent).not.toHaveBeenCalled()
    })

    it('falha de rede é engolida e deixa o passo tentar de novo', async () => {
        vi.mocked(reportFunnelEvent).mockRejectedValueOnce(new Error('rede'))
        const report = setup()
        report({ event: 'plans_opened', source: 'direct' })
        await Promise.resolve()
        await Promise.resolve()
        report({ event: 'plans_opened', source: 'direct' })

        expect(reportFunnelEvent).toHaveBeenCalledTimes(2)
    })
})
