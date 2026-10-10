import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from './enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'

const noSuppressions = () => createFakeEmailSuppressionRepository()

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
    const result = await new EnqueueEmailUseCase(outbox, noSuppressions()).execute(base)

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
    const useCase = new EnqueueEmailUseCase(outbox, noSuppressions())

    const first = await useCase.execute(base)
    const second = await useCase.execute({ ...base, payload: { link: 'https://outro' } })

    expect(second.status).toBe('duplicate')
    expect(second).toMatchObject({ id: (first as { id: string }).id })
    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0].payload).toEqual({ link: 'https://x' })
  })

  it('recusa endereço .invalid (conta anonimizada) sem gravar nada', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const result = await new EnqueueEmailUseCase(outbox, noSuppressions()).execute({
      ...base,
      to: 'usuario-removido-abc@anonimo.invalid',
    })

    expect(result).toEqual({ status: 'rejected', reason: 'undeliverable_address' })
    expect(outbox.rows).toHaveLength(0)
  })

  it('respeita sendAt para agendar', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const sendAt = new Date('2026-11-01T10:00:00Z')
    await new EnqueueEmailUseCase(outbox, noSuppressions()).execute({ ...base, sendAt })

    expect(outbox.rows[0].nextAttemptAt).toEqual(sendAt)
  })

  describe('lista de supressão', () => {
    it('bounce barra até e-mail de segurança: grava como suppressed e nunca envia', async () => {
      const outbox = createFakeEmailOutboxRepository()
      const useCase = new EnqueueEmailUseCase(
        outbox,
        createFakeEmailSuppressionRepository({ 'ana@exemplo.com': 'bounce' }),
      )

      const result = await useCase.execute(base)

      expect(result).toMatchObject({ status: 'suppressed', reason: 'bounce' })
      expect(outbox.rows[0]).toMatchObject({
        status: 'suppressed',
        lastError: 'suppressed:bounce',
      })
      expect(await outbox.claimBatch(10, new Date(Date.now() + 1000))).toEqual([])
    })

    it('reclamação barra o opcional mas deixa passar segurança e transacional', async () => {
      const outbox = createFakeEmailOutboxRepository()
      const useCase = new EnqueueEmailUseCase(
        outbox,
        createFakeEmailSuppressionRepository({ 'ana@exemplo.com': 'complaint' }),
      )

      const security = await useCase.execute({ ...base, idempotencyKey: 'k-sec' })
      const engagement = await useCase.execute({
        ...base,
        category: 'engagement',
        idempotencyKey: 'k-eng',
      })

      expect(security.status).toBe('enqueued')
      expect(engagement).toMatchObject({ status: 'suppressed', reason: 'complaint' })
    })

    it('a consulta usa o endereço normalizado', async () => {
      const outbox = createFakeEmailOutboxRepository()
      const useCase = new EnqueueEmailUseCase(
        outbox,
        createFakeEmailSuppressionRepository({ 'ana@exemplo.com': 'bounce' }),
      )

      const result = await useCase.execute({ ...base, to: '  ANA@Exemplo.com ' })

      expect(result.status).toBe('suppressed')
    })
  })
})
