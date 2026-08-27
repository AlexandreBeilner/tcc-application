import { describe, expect, it } from 'vitest'
import { createFakeAccountReader } from '../../test/fakes/fakeAccountReader'
import { ListMyEventsUseCase } from './listMyEvents'

describe('ListMyEventsUseCase', () => {
  it('repassa userId e paginação pro AccountReader', async () => {
    const events = [
      {
        id: 'event-1',
        event_type: 'initial_deposit',
        timestamp: '2026-01-01T00:00:00Z',
      },
    ]
    const accountReader = createFakeAccountReader({ events })
    const useCase = new ListMyEventsUseCase(accountReader)

    const result = await useCase.execute({ userId: 'user-1', limit: 20, offset: 0 })

    expect(result).toEqual(events)
    expect(accountReader.listAccountEventsCalls).toEqual([
      { userId: 'user-1', query: { limit: 20, offset: 0 } },
    ])
  })
})
