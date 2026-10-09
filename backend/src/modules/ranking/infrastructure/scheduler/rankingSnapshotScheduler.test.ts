import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComputeRankingSnapshotUseCase } from '../../application/useCases/computeRankingSnapshot'
import { startRankingSnapshotScheduler } from './rankingSnapshotScheduler'

function useCaseWith(execute: () => Promise<unknown>): ComputeRankingSnapshotUseCase {
  return { execute } as unknown as ComputeRankingSnapshotUseCase
}

describe('startRankingSnapshotScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('roda já na subida e depois a cada intervalo', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const execute = vi.fn().mockResolvedValue({ users: 1, groups: 7 })

    const timer = startRankingSnapshotScheduler(useCaseWith(execute), 1000)
    await vi.advanceTimersByTimeAsync(0)
    expect(execute).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(execute).toHaveBeenCalledTimes(3)
    clearInterval(timer)
  })

  it('uma falha é logada e não impede a próxima execução', async () => {
    vi.useFakeTimers()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const execute = vi.fn().mockRejectedValueOnce(new Error('motor fora')).mockResolvedValue({
      users: 0,
      groups: 7,
    })

    const timer = startRankingSnapshotScheduler(useCaseWith(execute), 1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(error).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(2)
    clearInterval(timer)
  })

  it('não sobrepõe uma execução que ainda está rodando', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    let finish: () => void = () => {}
    const execute = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ users: 0, groups: 7 })
        }),
    )

    const timer = startRankingSnapshotScheduler(useCaseWith(execute), 1000)
    await vi.advanceTimersByTimeAsync(3000)
    expect(execute).toHaveBeenCalledTimes(1)

    finish()
    await vi.advanceTimersByTimeAsync(1000)
    expect(execute).toHaveBeenCalledTimes(2)
    clearInterval(timer)
  })
})
