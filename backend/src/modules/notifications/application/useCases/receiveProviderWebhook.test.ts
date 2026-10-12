import { describe, expect, it } from 'vitest'
import { InvalidWebhookSignatureError } from '../../domain/errors'
import type { ProviderEvent } from '../../domain/providerEvent'
import type { WebhookEventParser } from '../ports/webhookEventParser'
import { ReceiveProviderWebhookUseCase } from './receiveProviderWebhook'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'

const T0 = new Date('2026-10-09T12:00:00Z')
const request = { rawBody: '{}', headers: { id: 'i', timestamp: 't', signature: 's' } }

function setup(event: ProviderEvent | Error) {
  const outbox = createFakeEmailOutboxRepository()
  const suppressions = createFakeEmailSuppressionRepository()
  const parser: WebhookEventParser = {
    parse() {
      if (event instanceof Error) throw event
      return event
    },
  }
  return {
    outbox,
    suppressions,
    useCase: new ReceiveProviderWebhookUseCase(parser, outbox, suppressions, () => T0),
  }
}

describe('ReceiveProviderWebhookUseCase', () => {
  it('assinatura inválida propaga o erro e não altera nada', async () => {
    const { suppressions, useCase } = setup(new InvalidWebhookSignatureError())

    await expect(useCase.execute(request)).rejects.toBeInstanceOf(InvalidWebhookSignatureError)
    expect(suppressions.entries.size).toBe(0)
  })

  it('bounce permanente suprime cada destinatário, em minúsculo', async () => {
    const { suppressions, useCase } = setup({
      type: 'bounced',
      providerMessageId: 'm1',
      recipients: ['Ana@Exemplo.com', 'bia@exemplo.com'],
      permanent: true,
    })

    expect(await useCase.execute(request)).toBe('bounced')
    expect([...suppressions.entries]).toEqual([
      ['ana@exemplo.com', 'bounce'],
      ['bia@exemplo.com', 'bounce'],
    ])
  })

  it('bounce transitório não suprime', async () => {
    const { suppressions, useCase } = setup({
      type: 'bounced',
      providerMessageId: 'm1',
      recipients: ['ana@exemplo.com'],
      permanent: false,
    })

    await useCase.execute(request)

    expect(suppressions.entries.size).toBe(0)
  })

  it('reclamação suprime como complaint', async () => {
    const { suppressions, useCase } = setup({
      type: 'complained',
      providerMessageId: 'm1',
      recipients: ['ana@exemplo.com'],
    })

    await useCase.execute(request)

    expect(suppressions.entries.get('ana@exemplo.com')).toBe('complaint')
  })

  it('reclamação depois de bounce não rebaixa a supressão', async () => {
    const { suppressions, useCase } = setup({
      type: 'complained',
      providerMessageId: 'm1',
      recipients: ['ana@exemplo.com'],
    })
    await suppressions.add('ana@exemplo.com', 'bounce', T0)

    await useCase.execute(request)

    expect(suppressions.entries.get('ana@exemplo.com')).toBe('bounce')
  })

  it('delivered marca a entrega na linha do provedor', async () => {
    const { outbox, useCase } = setup({ type: 'delivered', providerMessageId: 'msg-9' })
    const { id } = await outbox.enqueue({
      userId: null,
      toAddress: 'ana@exemplo.com',
      templateKey: 'test',
      category: 'transactional',
      payload: {},
      idempotencyKey: 'k',
    })
    await outbox.markSent(id, 'msg-9', T0)

    await useCase.execute(request)

    expect(outbox.rows[0].deliveredAt).toEqual(T0)
  })

  it('evento repetido deixa o mesmo estado (idempotente)', async () => {
    const { suppressions, useCase } = setup({
      type: 'bounced',
      providerMessageId: 'm1',
      recipients: ['ana@exemplo.com'],
      permanent: true,
    })

    await useCase.execute(request)
    await useCase.execute(request)

    expect([...suppressions.entries]).toEqual([['ana@exemplo.com', 'bounce']])
  })

  it('evento ignorado não faz nada', async () => {
    const { suppressions, useCase } = setup({ type: 'ignored' })

    expect(await useCase.execute(request)).toBe('ignored')
    expect(suppressions.entries.size).toBe(0)
  })
})
