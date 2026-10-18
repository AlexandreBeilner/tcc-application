import { describe, expect, it, vi } from 'vitest'
import { FakePresenceRepository } from '../test/fakes/fakePresenceRepository'
import { RecordPresenceUseCase } from './recordPresence'

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('RecordPresenceUseCase', () => {
  it('duas requisições no mesmo dia geram uma escrita só', async () => {
    const repo = new FakePresenceRepository()
    const useCase = new RecordPresenceUseCase(repo, () => new Date('2026-10-18T10:00:00Z'))
    useCase.touch('u1')
    useCase.touch('u1')
    useCase.touch('u2')
    await flush()
    expect(repo.writes).toEqual([
      { userId: 'u1', day: '2026-10-18' },
      { userId: 'u2', day: '2026-10-18' },
    ])
  })

  it('grava de novo quando o dia UTC vira', async () => {
    const repo = new FakePresenceRepository()
    let now = new Date('2026-10-18T23:59:00Z')
    const useCase = new RecordPresenceUseCase(repo, () => now)
    useCase.touch('u1')
    now = new Date('2026-10-19T00:01:00Z')
    useCase.touch('u1')
    await flush()
    expect(repo.writes.map((w) => w.day)).toEqual(['2026-10-18', '2026-10-19'])
  })

  it('falha ao gravar vira log, não derruba, e a próxima requisição tenta de novo', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const repo = new FakePresenceRepository()
    const useCase = new RecordPresenceUseCase(repo, () => new Date('2026-10-18T10:00:00Z'))
    repo.failNext = true
    expect(() => useCase.touch('u1')).not.toThrow()
    await flush()
    expect(error).toHaveBeenCalled()
    useCase.touch('u1')
    await flush()
    expect(repo.writes).toEqual([{ userId: 'u1', day: '2026-10-18' }])
    error.mockRestore()
  })
})
