import { describe, expect, it } from 'vitest'
import { createFakeSocialFeedEventRepository } from '../../test/fakes/fakeSocialFeedEventRepository'
import { RecordTrackCompletedUseCase } from './recordTrackCompleted'

describe('RecordTrackCompletedUseCase', () => {
  it('grava um evento track_completed com o número da trilha', async () => {
    const repository = createFakeSocialFeedEventRepository()
    const useCase = new RecordTrackCompletedUseCase(repository)

    await useCase.execute({ userId: 'user-1', trackNumber: 1 })

    expect(repository.events).toEqual([
      expect.objectContaining({ userId: 'user-1', type: 'track_completed', trackNumber: 1 }),
    ])
  })

  it('nunca inclui patrimônio/rentabilidade no evento gravado', async () => {
    const repository = createFakeSocialFeedEventRepository()
    const useCase = new RecordTrackCompletedUseCase(repository)

    await useCase.execute({ userId: 'user-1', trackNumber: 2 })

    const [event] = repository.events
    expect(Object.keys(event).sort()).toEqual(
      ['data', 'id', 'occurredAt', 'trackNumber', 'type', 'userId'].sort(),
    )
  })
})
