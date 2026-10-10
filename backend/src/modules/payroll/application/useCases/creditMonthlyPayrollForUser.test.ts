import { describe, expect, it, vi } from 'vitest'
import { CreditMonthlyPayrollForUserUseCase } from './creditMonthlyPayrollForUser'
import { createFakeLevelReader } from '../../test/fakes/fakeLevelReader'
import { createFakePayrollStateRepository } from '../../test/fakes/fakePayrollStateRepository'
import { createFakeSalaryMailer } from '../../test/fakes/fakeSalaryMailer'
import { createFakeSalaryCrediter } from '../../test/fakes/fakeSalaryCrediter'

const USER_ID = 'user-1'

describe('CreditMonthlyPayrollForUserUseCase', () => {
  it('pago — mês corrente vencido e nunca pago antes credita e grava o mês', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository()
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
      createFakeSalaryMailer(),
    )

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 3,
    })

    expect(result).toEqual({ monthsPaid: ['2026-09'], amountPerMonth: 1000 })
    expect(crediter.credits).toEqual([{ userId: USER_ID, amount: 1000, referenceMonth: '2026-09' }])
    await expect(stateRepository.getLastPaidMonth(USER_ID)).resolves.toBe('2026-09')
  })

  it('já pago — mês corrente já é o último pago, não credita de novo', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository({ [USER_ID]: '2026-09' })
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
      createFakeSalaryMailer(),
    )

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 20,
      maxCatchUpMonths: 3,
    })

    expect(result).toEqual({ monthsPaid: [], amountPerMonth: 0 })
    expect(crediter.credits).toEqual([])
  })

  it('dois checks no mesmo dia não pagam duas vezes', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository()
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
      createFakeSalaryMailer(),
    )
    const input = {
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 3,
    }

    await useCase.execute(input)
    const secondResult = await useCase.execute(input)

    expect(secondResult).toEqual({ monthsPaid: [], amountPerMonth: 0 })
    expect(crediter.credits).toHaveLength(1)
  })

  it('fora do dia — mês corrente ainda não venceu, não credita', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository()
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
      createFakeSalaryMailer(),
    )

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 3,
      maxCatchUpMonths: 3,
    })

    expect(result).toEqual({ monthsPaid: [], amountPerMonth: 0 })
    expect(crediter.credits).toEqual([])
    await expect(stateRepository.getLastPaidMonth(USER_ID)).resolves.toBeNull()
  })

  it('catch-up — reinício do backend depois de perder o mês passado inteiro paga os dois meses devidos, uma vez cada', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 20 })
    const stateRepository = createFakePayrollStateRepository({ [USER_ID]: '2026-07' })
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
      createFakeSalaryMailer(),
    )

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 3,
    })

    expect(result).toEqual({ monthsPaid: ['2026-08', '2026-09'], amountPerMonth: 3000 })
    // Achado 025: cada crédito do catch-up leva o referenceMonth do mês que
    // está pagando, não o dia em que o job de fato rodou — é isso que deixa
    // "salário de agosto" e "salário de setembro" distinguíveis mesmo caindo
    // no mesmo simulated_day no motor.
    expect(crediter.credits).toEqual([
      { userId: USER_ID, amount: 3000, referenceMonth: '2026-08' },
      { userId: USER_ID, amount: 3000, referenceMonth: '2026-09' },
    ])
    await expect(stateRepository.getLastPaidMonth(USER_ID)).resolves.toBe('2026-09')
  })

  it('catch-up respeita o teto — meses além do teto nunca são creditados', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository({ [USER_ID]: '2026-04' })
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
      createFakeSalaryMailer(),
    )

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 2,
    })

    expect(result.monthsPaid).toEqual(['2026-08', '2026-09'])
    expect(crediter.credits).toHaveLength(2)
  })

  describe('aviso por e-mail (EM.7.2)', () => {
    const input = (currentMonthKey: string, days = 5) => ({
      userId: USER_ID,
      currentMonthKey,
      currentMonthBusinessDaysElapsed: days,
      maxCatchUpMonths: 3,
    })

    it('manda um aviso com o valor depois de creditar', async () => {
      const mailer = createFakeSalaryMailer()
      const useCase = new CreditMonthlyPayrollForUserUseCase(
        createFakeLevelReader({ [USER_ID]: 10 }),
        createFakePayrollStateRepository(),
        createFakeSalaryCrediter(),
        mailer,
      )

      await useCase.execute(input('2026-09'))

      expect(mailer.sent).toEqual([
        { userId: USER_ID, monthKeys: ['2026-09'], amountPerMonth: 1000 },
      ])
    })

    it('catch-up de vários meses manda um aviso só, com todos os meses', async () => {
      const mailer = createFakeSalaryMailer()
      const useCase = new CreditMonthlyPayrollForUserUseCase(
        createFakeLevelReader({ [USER_ID]: 10 }),
        createFakePayrollStateRepository({ [USER_ID]: '2026-07' }),
        createFakeSalaryCrediter(),
        mailer,
      )

      await useCase.execute(input('2026-09'))

      expect(mailer.sent).toHaveLength(1)
      expect(mailer.sent[0].monthKeys).toEqual(['2026-08', '2026-09'])
    })

    it('sem nada a pagar não manda aviso', async () => {
      const mailer = createFakeSalaryMailer()
      const useCase = new CreditMonthlyPayrollForUserUseCase(
        createFakeLevelReader({ [USER_ID]: 10 }),
        createFakePayrollStateRepository({ [USER_ID]: '2026-09' }),
        createFakeSalaryCrediter(),
        mailer,
      )

      await useCase.execute(input('2026-09', 20))

      expect(mailer.sent).toEqual([])
    })

    it('falha no aviso nunca desfaz o crédito nem o mês gravado', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = createFakePayrollStateRepository()
      const crediter = createFakeSalaryCrediter()
      const useCase = new CreditMonthlyPayrollForUserUseCase(
        createFakeLevelReader({ [USER_ID]: 10 }),
        state,
        crediter,
        {
          sendSalaryCredited: async () => {
            throw new Error('outbox fora')
          },
        },
      )

      const result = await useCase.execute(input('2026-09'))

      expect(result.monthsPaid).toEqual(['2026-09'])
      expect(crediter.credits).toHaveLength(1)
      await expect(state.getLastPaidMonth(USER_ID)).resolves.toBe('2026-09')
      spy.mockRestore()
    })
  })
})
