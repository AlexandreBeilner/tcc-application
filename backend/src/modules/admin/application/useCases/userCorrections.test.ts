import { createFakeAccountMailer } from '../../../auth/test/fakes/fakeAccountMailer'
import { describe, expect, it } from 'vitest'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import {
  AdminCorrectionConflictError,
  AdminUserNotFoundError,
  CashCreditRejectedError,
} from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeUserCashCreditor } from '../../test/fakes/fakeUserCashCreditor'
import { createFakeUserCorrections } from '../../test/fakes/fakeUserCorrections'
import { CreditUserCashUseCase } from './creditUserCash'
import { RecordAdminActionUseCase } from './recordAdminAction'
import {
  AdjustUserXpUseCase,
  CompleteUserLessonUseCase,
  GetUserCorrectionContextUseCase,
  GrantUserAchievementUseCase,
  ReopenUserLessonUseCase,
  SetUserStreakUseCase,
} from './userCorrections'

async function build() {
  const userRepository = createFakeUserRepository()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const corrections = createFakeUserCorrections()
  const cashCreditor = createFakeUserCashCreditor()
  const admin = await userRepository.createUser({
    name: 'Admin',
    email: 'admin@example.com',
    username: 'admin',
    passwordHash: 'x',
    role: 'admin',
  })
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: 'x',
  })
  const mailer = createFakeAccountMailer()
  let seq = 0
  const newEventId = () => `evento-${++seq}`
  return {
    auditLog,
    mailer,
    corrections,
    cashCreditor,
    admin,
    user,
    credit: new CreditUserCashUseCase(userRepository, cashCreditor, record, mailer, newEventId),
    adjustXp: new AdjustUserXpUseCase(userRepository, corrections, record, mailer, newEventId),
    setStreak: new SetUserStreakUseCase(userRepository, corrections, record, mailer, newEventId),
    grant: new GrantUserAchievementUseCase(userRepository, corrections, record, mailer, newEventId),
    complete: new CompleteUserLessonUseCase(
      userRepository,
      corrections,
      record,
      mailer,
      newEventId,
    ),
    reopen: new ReopenUserLessonUseCase(userRepository, corrections, record, mailer, newEventId),
    context: new GetUserCorrectionContextUseCase(userRepository, corrections),
  }
}

describe('CreditUserCashUseCase', () => {
  it('credita, e audita valor, usuário, motivo e o que o motor creditou', async () => {
    const { credit, cashCreditor, admin, user, auditLog } = await build()

    const result = await credit.execute(admin.id, user.id, {
      amount: 1234.567,
      reason: 'reparo do bug 0042',
    })

    expect(result).toEqual({ credited: 1234.57 })
    expect(cashCreditor.calls).toEqual([{ userId: user.id, amount: 1234.567 }])
    expect(auditLog.entries[0]).toMatchObject({
      action: 'user.credit',
      targetType: 'user',
      targetId: user.id,
      adminId: admin.id,
      result: 'success',
      payload: { amount: 1234.567, reason: 'reparo do bug 0042', credited: 1234.57 },
    })
  })

  it('avisa o usuário do valor creditado, sem o motivo interno do admin (E10)', async () => {
    const { credit, mailer, admin, user } = await build()

    await credit.execute(admin.id, user.id, { amount: 1234.567, reason: 'reparo do bug 0042' })

    expect(mailer.adjustments).toHaveLength(1)
    expect(mailer.adjustments[0]).toMatchObject({ userId: user.id, to: 'fulano@example.com' })
    expect(mailer.adjustments[0].summary).toMatch(/1\.234,57/)
    expect(mailer.adjustments[0].summary).not.toContain('bug')
  })

  it('crédito recusado pelo motor não avisa ninguém', async () => {
    const { credit, cashCreditor, mailer, admin, user } = await build()
    cashCreditor.failWith = new CashCreditRejectedError('valor de crédito inválido')

    await expect(credit.execute(admin.id, user.id, { amount: 0 })).rejects.toBeInstanceOf(
      CashCreditRejectedError,
    )

    expect(mailer.adjustments).toEqual([])
  })

  it('falha ao enfileirar o aviso não desfaz o crédito', async () => {
    const { credit, mailer, admin, user } = await build()
    mailer.failWith(new Error('outbox fora do ar'))

    await expect(credit.execute(admin.id, user.id, { amount: 10 })).resolves.toEqual({
      credited: 10,
    })
  })

  it('o motivo é opcional e some do log quando não vem', async () => {
    const { credit, admin, user, auditLog } = await build()

    await credit.execute(admin.id, user.id, { amount: 500 })

    expect(auditLog.entries[0].payload).toEqual({ amount: 500, credited: 500 })
  })

  it('recusa usuário inexistente sem chamar o motor, e audita a falha', async () => {
    const { credit, cashCreditor, admin, auditLog } = await build()

    await expect(credit.execute(admin.id, 'sem-usuario', { amount: 10 })).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    )

    expect(cashCreditor.calls).toEqual([])
    expect(auditLog.entries[0]).toMatchObject({ action: 'user.credit', result: 'failed' })
  })

  it('a recusa do motor vira falha auditada e não deixa crédito', async () => {
    const { credit, cashCreditor, admin, user, auditLog } = await build()
    cashCreditor.failWith = new CashCreditRejectedError('valor de crédito inválido')

    await expect(credit.execute(admin.id, user.id, { amount: 0 })).rejects.toBeInstanceOf(
      CashCreditRejectedError,
    )

    expect(auditLog.entries[0]).toMatchObject({
      result: 'failed',
      errorMessage: 'valor de crédito inválido',
      payload: { amount: 0 },
    })
  })
})

describe('correções de gamificação e lição', () => {
  it('cada correção chama a porta com os argumentos certos e audita ação, alvo e motivo', async () => {
    const t = await build()
    const reason = 'ajuste de suporte'

    await t.adjustXp.execute(t.admin.id, t.user.id, { delta: -50, reason })
    await t.setStreak.execute(t.admin.id, t.user.id, { value: 7, reason })
    await t.grant.execute(t.admin.id, t.user.id, 'a1', reason)
    await t.complete.execute(t.admin.id, t.user.id, 'l1', reason)
    await t.reopen.execute(t.admin.id, t.user.id, 'l1', reason)

    expect(t.corrections.calls).toEqual([
      { method: 'adjustXp', args: [t.user.id, -50] },
      { method: 'setStreak', args: [t.user.id, 7] },
      { method: 'grantAchievement', args: [t.user.id, 'a1'] },
      { method: 'completeLesson', args: [t.user.id, 'l1'] },
      { method: 'reopenLesson', args: [t.user.id, 'l1'] },
    ])
    expect(t.auditLog.entries.map((e) => e.action)).toEqual([
      'user.adjust_xp',
      'user.set_streak',
      'user.grant_achievement',
      'user.complete_lesson',
      'user.reopen_lesson',
    ])
    for (const entry of t.auditLog.entries) {
      expect(entry).toMatchObject({
        targetType: 'user',
        targetId: t.user.id,
        result: 'success',
        payload: expect.objectContaining({ reason }),
      })
    }
    expect(t.auditLog.entries[2].payload).toMatchObject({
      achievement_id: 'a1',
      achievement_name: 'Primeira Semana',
    })
    expect(t.auditLog.entries[4].payload).toMatchObject({ lesson_id: 'l1', lesson_code: '0.1' })
  })

  it('usuário inexistente é recusado antes de tocar a porta, em todas', async () => {
    const t = await build()
    const attempts = [
      t.adjustXp.execute(t.admin.id, 'x', { delta: 1, reason: 'motivo' }),
      t.setStreak.execute(t.admin.id, 'x', { value: 1, reason: 'motivo' }),
      t.grant.execute(t.admin.id, 'x', 'a1', 'motivo'),
      t.complete.execute(t.admin.id, 'x', 'l1', 'motivo'),
      t.reopen.execute(t.admin.id, 'x', 'l1', 'motivo'),
      t.context.execute('x'),
    ]

    for (const attempt of attempts) {
      await expect(attempt).rejects.toBeInstanceOf(AdminUserNotFoundError)
    }
    expect(t.corrections.calls).toEqual([])
  })

  it('a recusa da porta vira falha auditada com a mensagem', async () => {
    const t = await build()
    t.corrections.failWith = new AdminCorrectionConflictError('o usuário já tem essa conquista')

    await expect(t.grant.execute(t.admin.id, t.user.id, 'a1', 'motivo')).rejects.toBeInstanceOf(
      AdminCorrectionConflictError,
    )

    expect(t.auditLog.entries[0]).toMatchObject({
      action: 'user.grant_achievement',
      result: 'failed',
      errorMessage: 'o usuário já tem essa conquista',
    })
  })

  it('devolve o contexto de seletores do usuário', async () => {
    const t = await build()

    const context = await t.context.execute(t.user.id)

    expect(context.achievements).toHaveLength(1)
    expect(context.lessons).toHaveLength(1)
  })
})

describe('aviso das correções de conta (E10)', () => {
  it('cada correção bem-sucedida avisa o usuário, sem o motivo interno', async () => {
    const { adjustXp, setStreak, complete, reopen, mailer, admin, user } = await build()

    await adjustXp.execute(admin.id, user.id, { delta: 50, reason: 'nota interna A' })
    await setStreak.execute(admin.id, user.id, { value: 7, reason: 'nota interna B' })
    await complete.execute(admin.id, user.id, 'lesson-1', 'nota interna C')
    await reopen.execute(admin.id, user.id, 'lesson-1', 'nota interna D')

    expect(mailer.adjustments).toHaveLength(4)
    expect(mailer.adjustments.map((m) => m.eventId)).toEqual([
      'evento-1',
      'evento-2',
      'evento-3',
      'evento-4',
    ])
    expect(mailer.adjustments[0].summary).toContain('+50')
    expect(mailer.adjustments[1].summary).toContain('7')
    expect(JSON.stringify(mailer.adjustments)).not.toContain('nota interna')
  })

  it('usuário inexistente não gera aviso', async () => {
    const { adjustXp, mailer, admin } = await build()

    await expect(
      adjustXp.execute(admin.id, 'sem-usuario', { delta: 1, reason: 'x' }),
    ).rejects.toBeInstanceOf(AdminUserNotFoundError)

    expect(mailer.adjustments).toEqual([])
  })
})
