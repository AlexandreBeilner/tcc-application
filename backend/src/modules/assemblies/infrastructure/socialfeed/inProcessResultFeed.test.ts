import { describe, expect, it, vi } from 'vitest'
import { createInProcessResultFeed } from './inProcessResultFeed'

describe('createInProcessResultFeed', () => {
  it('repassa só a participação e o desfecho, nunca a opção vencedora', async () => {
    const recorder = { execute: vi.fn(async () => undefined) }

    await createInProcessResultFeed(recorder).publishParticipation('u1', {
      assemblyId: 'asm-1',
      subjectLabel: 'Acme',
      title: 'Orçamento',
      outcome: 'approved',
      reason: 'decided',
      winningLabel: 'Expandir',
    })

    expect(recorder.execute).toHaveBeenCalledWith({
      userId: 'u1',
      data: { assemblyId: 'asm-1', subjectLabel: 'Acme', title: 'Orçamento', outcome: 'approved' },
    })
  })
})
