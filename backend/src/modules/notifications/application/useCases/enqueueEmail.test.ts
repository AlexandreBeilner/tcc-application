import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from './enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'
import { createFakeOptionalEmailDeps } from '../../test/fakes/fakeOptionalEmailDeps'
import { createFakeRecipientDirectory } from '../../test/fakes/fakeRecipientDirectory'

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
    const result = await new EnqueueEmailUseCase(
      outbox,
      noSuppressions(),
      createFakeOptionalEmailDeps(),
    ).execute(base)

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
    const useCase = new EnqueueEmailUseCase(outbox, noSuppressions(), createFakeOptionalEmailDeps())

    const first = await useCase.execute(base)
    const second = await useCase.execute({ ...base, payload: { link: 'https://outro' } })

    expect(second.status).toBe('duplicate')
    expect(second).toMatchObject({ id: (first as { id: string }).id })
    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0].payload).toEqual({ link: 'https://x' })
  })

  it('recusa endereço .invalid (conta anonimizada) sem gravar nada', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const result = await new EnqueueEmailUseCase(
      outbox,
      noSuppressions(),
      createFakeOptionalEmailDeps(),
    ).execute({
      ...base,
      to: 'usuario-removido-abc@anonimo.invalid',
    })

    expect(result).toEqual({ status: 'rejected', reason: 'undeliverable_address' })
    expect(outbox.rows).toHaveLength(0)
  })

  it('respeita sendAt para agendar', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const sendAt = new Date('2026-11-01T10:00:00Z')
    await new EnqueueEmailUseCase(outbox, noSuppressions(), createFakeOptionalEmailDeps()).execute({
      ...base,
      sendAt,
    })

    expect(outbox.rows[0].nextAttemptAt).toEqual(sendAt)
  })

  describe('lista de supressão', () => {
    it('bounce barra até e-mail de segurança: grava como suppressed e nunca envia', async () => {
      const outbox = createFakeEmailOutboxRepository()
      const useCase = new EnqueueEmailUseCase(
        outbox,
        createFakeEmailSuppressionRepository({ 'ana@exemplo.com': 'bounce' }),
        createFakeOptionalEmailDeps(),
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
        createFakeOptionalEmailDeps({
          preferences: createFakeEmailPreferencesRepository({ 'user-1': { engagement: true } }),
          recipients: createFakeRecipientDirectory({
            'user-1': { address: 'ana@exemplo.com', status: 'active', emailVerified: true },
          }),
        }),
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
        createFakeOptionalEmailDeps(),
      )

      const result = await useCase.execute({ ...base, to: '  ANA@Exemplo.com ' })

      expect(result.status).toBe('suppressed')
    })
  })

  describe('categoria opcional (EM.6.1, D8)', () => {
    const eligible = { address: 'ana@exemplo.com', status: 'active' as const, emailVerified: true }
    const social = {
      ...base,
      category: 'social' as const,
      payload: { requester: 'bia' },
      idempotencyKey: 'social:1',
    }
    const setup = (
      recipient: Partial<typeof eligible> | null,
      prefs: { social?: boolean; engagement?: boolean } = { social: true },
    ) => {
      const outbox = createFakeEmailOutboxRepository()
      const deps = createFakeOptionalEmailDeps({
        preferences: createFakeEmailPreferencesRepository({ 'user-1': prefs }),
        recipients: createFakeRecipientDirectory(
          recipient ? { 'user-1': { ...eligible, ...recipient } } : {},
        ),
      })
      return { outbox, useCase: new EnqueueEmailUseCase(outbox, noSuppressions(), deps) }
    }

    it('com opt-in, enfileira e injeta o link de cancelar no payload', async () => {
      const { outbox, useCase } = setup({})

      const result = await useCase.execute(social)

      expect(result.status).toBe('enqueued')
      expect(outbox.rows[0].payload).toEqual({
        requester: 'bia',
        unsubscribeUrl: 'https://api.test/email/unsubscribe?token=user-1|social',
      })
    })

    it('sem opt-in (o padrão), não grava nada', async () => {
      const { outbox, useCase } = setup({}, {})

      expect(await useCase.execute(social)).toEqual({ status: 'rejected', reason: 'not_opted_in' })
      expect(outbox.rows).toHaveLength(0)
    })

    it('a preferência de uma categoria não vale para a outra', async () => {
      const { outbox, useCase } = setup({}, { social: true })

      const result = await useCase.execute({ ...social, category: 'engagement' })

      expect(result).toEqual({ status: 'rejected', reason: 'not_opted_in' })
      expect(outbox.rows).toHaveLength(0)
    })

    it.each([
      ['conta suspensa', { status: 'suspended' as const }],
      ['e-mail não verificado', { emailVerified: false }],
      ['conta anonimizada', { address: 'usuario-removido-1@anonimo.invalid' }],
    ])('%s não recebe e-mail opcional mesmo com opt-in', async (_label, recipient) => {
      const { outbox, useCase } = setup(recipient)

      expect(await useCase.execute(social)).toEqual({
        status: 'rejected',
        reason: 'recipient_not_eligible',
      })
      expect(outbox.rows).toHaveLength(0)
    })

    it('sem usuário ou com usuário desconhecido, recusa', async () => {
      const known = setup({})
      const unknown = setup(null)

      expect(await known.useCase.execute({ ...social, userId: null })).toEqual({
        status: 'rejected',
        reason: 'recipient_unknown',
      })
      expect(await unknown.useCase.execute(social)).toEqual({
        status: 'rejected',
        reason: 'recipient_unknown',
      })
    })

    it('acceptsOptional diz se o destinatário aceita, sem gravar nada', async () => {
      const optedIn = setup({})
      const optedOut = setup({}, {})
      const suspended = setup({ status: 'suspended' })

      expect(await optedIn.useCase.acceptsOptional('user-1', 'social')).toBe(true)
      expect(await optedIn.useCase.acceptsOptional('user-1', 'engagement')).toBe(false)
      expect(await optedOut.useCase.acceptsOptional('user-1', 'social')).toBe(false)
      expect(await suspended.useCase.acceptsOptional('user-1', 'social')).toBe(false)
      expect(optedIn.outbox.rows).toHaveLength(0)
    })

    it('segurança e transacional ignoram preferência e elegibilidade', async () => {
      const { outbox, useCase } = setup({ status: 'suspended' }, {})

      const result = await useCase.execute({ ...base, category: 'security' })

      expect(result.status).toBe('enqueued')
      expect(outbox.rows[0].payload).not.toHaveProperty('unsubscribeUrl')
    })

    it('a reclamação ainda barra o opcional mesmo com opt-in (grava como suppressed)', async () => {
      const outbox = createFakeEmailOutboxRepository()
      const useCase = new EnqueueEmailUseCase(
        outbox,
        createFakeEmailSuppressionRepository({ 'ana@exemplo.com': 'complaint' }),
        createFakeOptionalEmailDeps({
          preferences: createFakeEmailPreferencesRepository({ 'user-1': { social: true } }),
          recipients: createFakeRecipientDirectory({ 'user-1': eligible }),
        }),
      )

      expect(await useCase.execute(social)).toMatchObject({
        status: 'suppressed',
        reason: 'complaint',
      })
    })
  })
})
