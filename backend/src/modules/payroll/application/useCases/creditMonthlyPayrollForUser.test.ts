import { describe, expect, it } from 'vitest'
import { CreditMonthlyPayrollForUserUseCase } from './creditMonthlyPayrollForUser'
import { createFakeLevelReader } from '../../test/fakes/fakeLevelReader'
import { createFakePayrollStateRepository } from '../../test/fakes/fakePayrollStateRepository'
import { createFakeSalaryCrediter } from '../../test/fakes/fakeSalaryCrediter'

const USER_ID = 'user-1'

describe('CreditMonthlyPayrollForUserUseCase', () => {
  it('pago — mês corrente vencido e nunca pago antes credita e grava o mês', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository()
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(levelReader, stateRepository, crediter)

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 3,
    })

    expect(result).toEqual({ monthsPaid: ['2026-09'], amountPerMonth: 1000 })
    expect(crediter.credits).toEqual([{ userId: USER_ID, amount: 1000 }])
    await expect(stateRepository.getLastPaidMonth(USER_ID)).resolves.toBe('2026-09')
  })

  it('já pago — mês corrente já é o último pago, não credita de novo', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository({ [USER_ID]: '2026-09' })
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(levelReader, stateRepository, crediter)

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
    const useCase = new CreditMonthlyPayrollForUserUseCase(levelReader, stateRepository, crediter)
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
    const useCase = new CreditMonthlyPayrollForUserUseCase(levelReader, stateRepository, crediter)

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
    const useCase = new CreditMonthlyPayrollForUserUseCase(levelReader, stateRepository, crediter)

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 3,
    })

    expect(result).toEqual({ monthsPaid: ['2026-08', '2026-09'], amountPerMonth: 3000 })
    expect(crediter.credits).toEqual([
      { userId: USER_ID, amount: 3000 },
      { userId: USER_ID, amount: 3000 },
    ])
    await expect(stateRepository.getLastPaidMonth(USER_ID)).resolves.toBe('2026-09')
  })

  it('catch-up respeita o teto — meses além do teto nunca são creditados', async () => {
    const levelReader = createFakeLevelReader({ [USER_ID]: 10 })
    const stateRepository = createFakePayrollStateRepository({ [USER_ID]: '2026-04' })
    const crediter = createFakeSalaryCrediter()
    const useCase = new CreditMonthlyPayrollForUserUseCase(levelReader, stateRepository, crediter)

    const result = await useCase.execute({
      userId: USER_ID,
      currentMonthKey: '2026-09',
      currentMonthBusinessDaysElapsed: 5,
      maxCatchUpMonths: 2,
    })

    expect(result.monthsPaid).toEqual(['2026-08', '2026-09'])
    expect(crediter.credits).toHaveLength(2)
  })
})
