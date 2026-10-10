import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from './enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'

const base = {
  userId: 'user-1',
  to: 'Ana@Exemplo.com',
  templateKey: 'test',
  category: 'security' as const,
  payload: { link: 'https://x' },
  idempotencyKey: 'test:1',
}

describe('EnqueueEmailUseCase', () => {
  it('grava pending com o endereço normalizado', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const result = await new EnqueueEmailUseCase(outbox).execute(base)

    expect(result.status).toBe('enqueued')
    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({
      toAddress: 'ana@exemplo.com',
      status: 'pending',
      attempts: 0,
      templateKey: 'test',
      category: 'security',
    })
  })

  it('é idempotente: mesma chave devolve a mesma linha e não duplica', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const useCase = new EnqueueEmailUseCase(outbox)

    const first = await useCase.execute(base)
    const second = await useCase.execute({ ...base, payload: { link: 'https://outro' } })

    expect(second.status).toBe('duplicate')
    expect(second).toMatchObject({ id: (first as { id: string }).id })
    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0].payload).toEqual({ link: 'https://x' })
  })

  it('recusa endereço .invalid (conta anonimizada) sem gravar nada', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const result = await new EnqueueEmailUseCase(outbox).execute({
      ...base,
      to: 'usuario-removido-abc@anonimo.invalid',
    })

    expect(result).toEqual({ status: 'rejected', reason: 'undeliverable_address' })
    expect(outbox.rows).toHaveLength(0)
  })

  it('respeita sendAt para agendar', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const sendAt = new Date('2026-11-01T10:00:00Z')
    await new EnqueueEmailUseCase(outbox).execute({ ...base, sendAt })

    expect(outbox.rows[0].nextAttemptAt).toEqual(sendAt)
  })
})
