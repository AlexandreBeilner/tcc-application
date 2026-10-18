import { describe, expect, it, vi } from 'vitest'
import { FakeMilestoneRepository } from '../test/fakes/fakeMilestoneRepository'
import { RecordMilestoneUseCase } from './recordMilestone'

describe('RecordMilestoneUseCase', () => {
  it('grava o marco uma vez e mantém a primeira data', async () => {
    const repo = new FakeMilestoneRepository()
    let now = new Date('2026-10-18T10:00:00Z')
    const useCase = new RecordMilestoneUseCase(repo, () => now)
    await useCase.execute('u1', 'first_lesson')
    now = new Date('2026-10-20T10:00:00Z')
    await useCase.execute('u1', 'first_lesson')
    expect(repo.reached.size).toBe(1)
    expect(repo.reached.get('u1:first_lesson')).toEqual(new Date('2026-10-18T10:00:00Z'))
  })

  it('falha ao gravar vira log e nunca propaga', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const repo = new FakeMilestoneRepository()
    repo.fail = true
    await expect(
      new RecordMilestoneUseCase(repo).execute('u1', 'first_trade'),
    ).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
