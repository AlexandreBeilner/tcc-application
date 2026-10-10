import { describe, expect, it } from 'vitest'
import { DeliverPendingEmailsUseCase } from './deliverPendingEmails'
import { EnqueueEmailUseCase } from './enqueueEmail'
import { MAX_DELIVERY_ATTEMPTS } from '../../domain/retryPolicy'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'
import { createFakeEmailRenderer } from '../../test/fakes/fakeEmailRenderer'
import {
  createFakeEmailSender,
  permanentError,
  transientError,
} from '../../test/fakes/fakeEmailSender'

const T0 = new Date('2026-10-09T12:00:00Z')

function setup(
  options: Partial<ConstructorParameters<typeof DeliverPendingEmailsUseCase>[3]> = {},
) {
  let clock = T0
  const outbox = createFakeEmailOutboxRepository(() => clock)
  const sender = createFakeEmailSender()
  const suppressions = createFakeEmailSuppressionRepository()
  const sleeps: number[] = []
  const deliver = new DeliverPendingEmailsUseCase(
    outbox,
    suppressions,
    createFakeEmailRenderer(),
    sender,
    { batchSize: 20, stuckAfterMs: 10 * 60_000, delayBetweenSendsMs: 0, ...options },
    () => clock,
    async (ms) => {
      sleeps.push(ms)
    },
  )
  const enqueue = (key: string, templateKey = 'test') =>
    new EnqueueEmailUseCase(outbox, suppressions).execute({
      userId: null,
      to: 'ana@exemplo.com',
      templateKey,
      category: 'transactional',
      payload: { n: key },
      idempotencyKey: key,
    })
  return {
    outbox,
    suppressions,
    sender,
    deliver,
    enqueue,
    sleeps,
    now: () => clock,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms)
    },
  }
}

describe('DeliverPendingEmailsUseCase', () => {
  it('envia, marca sent e usa o id da linha como chave de idempotência do provedor', async () => {
    const { outbox, sender, deliver, enqueue } = setup()
    await enqueue('a')

    const result = await deliver.execute()

    expect(result).toMatchObject({ claimed: 1, sent: 1, retried: 0, failed: 0 })
    expect(outbox.rows[0]).toMatchObject({
      status: 'sent',
      attempts: 1,
      providerMessageId: 'fake-1',
    })
    expect(sender.sent[0]).toMatchObject({
      to: 'ana@exemplo.com',
      subject: 'assunto test',
      idempotencyKey: outbox.rows[0].id,
    })
  })

  it('não reenvia o que já foi enviado nem o que está agendado pro futuro', async () => {
    const { outbox, sender, suppressions, deliver, enqueue } = setup()
    await enqueue('a')
    await deliver.execute()
    await new EnqueueEmailUseCase(outbox, suppressions).execute({
      userId: null,
      to: 'b@exemplo.com',
      templateKey: 'test',
      category: 'transactional',
      payload: {},
      idempotencyKey: 'futuro',
      sendAt: new Date(T0.getTime() + 3_600_000),
    })

    const result = await deliver.execute()

    expect(result.claimed).toBe(0)
    expect(sender.sent).toHaveLength(1)
  })

  it('erro transitório reagenda com backoff e o próximo ciclo reenvia', async () => {
    const { outbox, sender, deliver, enqueue, advance } = setup()
    await enqueue('a')
    sender.failNext(transientError('429'))

    const first = await deliver.execute()
    expect(first).toMatchObject({ retried: 1, sent: 0 })
    expect(outbox.rows[0]).toMatchObject({ status: 'pending', attempts: 1, lastError: '429' })
    expect(outbox.rows[0].nextAttemptAt).toEqual(new Date(T0.getTime() + 60_000))

    expect((await deliver.execute()).claimed).toBe(0)

    advance(60_000)
    const second = await deliver.execute()
    expect(second).toMatchObject({ sent: 1 })
    expect(outbox.rows[0]).toMatchObject({ status: 'sent', attempts: 2 })
  })

  it('aumenta o intervalo a cada falha transitória (1 min, 5 min, 30 min, 2 h)', async () => {
    const { outbox, sender, deliver, enqueue, advance, now } = setup()
    await enqueue('a')

    for (const expectedDelayMs of [60_000, 300_000, 1_800_000, 7_200_000]) {
      sender.failNext(transientError())
      await deliver.execute()
      expect(outbox.rows[0].status).toBe('pending')
      expect(outbox.rows[0].nextAttemptAt.getTime() - now().getTime()).toBe(expectedDelayMs)
      advance(expectedDelayMs)
    }
    expect(outbox.rows[0].attempts).toBe(4)
  })

  it('erro permanente vai direto pra failed, sem retry', async () => {
    const { outbox, sender, deliver, enqueue } = setup()
    await enqueue('a')
    sender.failNext(permanentError('endereço inválido'))

    const result = await deliver.execute()

    expect(result).toMatchObject({ failed: 1, retried: 0 })
    expect(outbox.rows[0]).toMatchObject({
      status: 'failed',
      lastError: 'endereço inválido',
      attempts: 1,
    })
  })

  it('esgota as tentativas e vira failed', async () => {
    const { outbox, sender, deliver, enqueue, advance } = setup()
    await enqueue('a')
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      sender.failNext(transientError('fora do ar'))
      advance(3 * 60 * 60_000)
      await deliver.execute()
    }

    expect(outbox.rows[0]).toMatchObject({ status: 'failed', attempts: MAX_DELIVERY_ATTEMPTS })
  })

  it('template inexistente falha na hora, sem consumir o provedor', async () => {
    const { outbox, sender, deliver, enqueue } = setup()
    await enqueue('a', 'nao-existe')

    const result = await deliver.execute()

    expect(result).toMatchObject({ failed: 1 })
    expect(outbox.rows[0].lastError).toContain('render:')
    expect(sender.sent).toHaveLength(0)
  })

  it('uma linha com erro não impede as seguintes do lote', async () => {
    const { outbox, sender, deliver, enqueue } = setup()
    await enqueue('a')
    await enqueue('b')
    sender.failNext(permanentError())

    const result = await deliver.execute()

    expect(result).toMatchObject({ claimed: 2, sent: 1, failed: 1 })
    expect(outbox.rows.map((r) => r.status).sort()).toEqual(['failed', 'sent'])
  })

  it('respeita o tamanho do lote', async () => {
    const { deliver, enqueue, sender } = setup({ batchSize: 2 })
    await enqueue('a')
    await enqueue('b')
    await enqueue('c')

    expect((await deliver.execute()).claimed).toBe(2)
    expect((await deliver.execute()).claimed).toBe(1)
    expect(sender.sent).toHaveLength(3)
  })

  it('espaça os envios (limite de requisições por segundo) sem esperar antes do primeiro', async () => {
    const { deliver, enqueue, sleeps } = setup({ delayBetweenSendsMs: 500 })
    await enqueue('a')
    await enqueue('b')
    await enqueue('c')

    await deliver.execute()

    expect(sleeps).toEqual([500, 500])
  })

  it('recupera linha sending presa por processo que caiu e a reenvia', async () => {
    const { outbox, sender, deliver, enqueue, advance } = setup()
    await enqueue('a')
    // simula o crash: reivindicada e nunca concluída
    await outbox.claimBatch(10, T0)
    expect(outbox.rows[0].status).toBe('sending')

    advance(5 * 60_000)
    expect((await deliver.execute()).recovered).toBe(0)
    expect(sender.sent).toHaveLength(0)

    advance(6 * 60_000)
    const result = await deliver.execute()

    expect(result).toMatchObject({ recovered: 1, sent: 1 })
    expect(outbox.rows[0]).toMatchObject({ status: 'sent', attempts: 2 })
  })

  it('linha presa que já esgotou as tentativas vai pra failed em vez de voltar', async () => {
    const { outbox, deliver, enqueue, advance } = setup()
    await enqueue('a')
    outbox.rows[0].attempts = MAX_DELIVERY_ATTEMPTS - 1
    await outbox.claimBatch(10, T0)
    advance(11 * 60_000)

    const result = await deliver.execute()

    expect(result).toMatchObject({ recovered: 1, claimed: 0 })
    expect(outbox.rows[0].status).toBe('failed')
  })

  it('endereço que levou bounce entre o enfileiramento e a entrega não recebe: vira suppressed', async () => {
    const { outbox, sender, suppressions, deliver, enqueue } = setup()
    await enqueue('a')
    await suppressions.add('ana@exemplo.com', 'bounce', T0)

    const result = await deliver.execute()

    expect(result).toMatchObject({ claimed: 1, suppressed: 1, sent: 0 })
    expect(outbox.rows[0]).toMatchObject({ status: 'suppressed', lastError: 'suppressed:bounce' })
    expect(sender.sent).toHaveLength(0)
  })

  it('reclamação não impede e-mail transacional já na fila', async () => {
    const { sender, suppressions, deliver, enqueue } = setup()
    await enqueue('a')
    await suppressions.add('ana@exemplo.com', 'complaint', T0)

    expect(await deliver.execute()).toMatchObject({ sent: 1, suppressed: 0 })
    expect(sender.sent).toHaveLength(1)
  })
})
