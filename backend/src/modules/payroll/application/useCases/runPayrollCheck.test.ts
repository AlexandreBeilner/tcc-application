import { describe, expect, it } from 'vitest'
import { RunPayrollCheckUseCase } from './runPayrollCheck'
import { CreditMonthlyPayrollForUserUseCase } from './creditMonthlyPayrollForUser'
import { createFakeLevelReader } from '../../test/fakes/fakeLevelReader'
import { createFakePayrollCalendarReader } from '../../test/fakes/fakePayrollCalendarReader'
import { createFakePayrollStateRepository } from '../../test/fakes/fakePayrollStateRepository'
import { createFakeSalaryCrediter } from '../../test/fakes/fakeSalaryCrediter'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'

describe('RunPayrollCheckUseCase', () => {
  it('credita todo usuário devido num único ciclo, uma leitura de calendário pra todos', async () => {
    const userDirectory = createFakeUserDirectory(['user-a', 'user-b'])
    const calendarReader = createFakePayrollCalendarReader({
      currentMonthKey: '2026-09',
      businessDaysElapsedThisMonth: 5,
    })
    const levelReader = createFakeLevelReader({ 'user-a': 10, 'user-b': 20 })
    const stateRepository = createFakePayrollStateRepository()
    const crediter = createFakeSalaryCrediter()
    const creditForUser = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
    )
    const useCase = new RunPayrollCheckUseCase(userDirectory, calendarReader, creditForUser, 3)

    const result = await useCase.execute()

    expect(result).toEqual({ usersChecked: 2, usersPaid: 2, monthsPaidTotal: 2 })
    expect(crediter.credits).toEqual([
      { userId: 'user-a', amount: 1000 },
      { userId: 'user-b', amount: 3000 },
    ])
  })

  it('usuário já pago não conta em usersPaid', async () => {
    const userDirectory = createFakeUserDirectory(['user-a'])
    const calendarReader = createFakePayrollCalendarReader({
      currentMonthKey: '2026-09',
      businessDaysElapsedThisMonth: 5,
    })
    const levelReader = createFakeLevelReader({ 'user-a': 10 })
    const stateRepository = createFakePayrollStateRepository({ 'user-a': '2026-09' })
    const crediter = createFakeSalaryCrediter()
    const creditForUser = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      crediter,
    )
    const useCase = new RunPayrollCheckUseCase(userDirectory, calendarReader, creditForUser, 3)

    const result = await useCase.execute()

    expect(result).toEqual({ usersChecked: 1, usersPaid: 0, monthsPaidTotal: 0 })
  })

  it('falha isolada num usuário não impede os demais de serem creditados', async () => {
    const userDirectory = createFakeUserDirectory(['user-a', 'user-b'])
    const calendarReader = createFakePayrollCalendarReader({
      currentMonthKey: '2026-09',
      businessDaysElapsedThisMonth: 5,
    })
    const levelReader = createFakeLevelReader({ 'user-a': 10, 'user-b': 10 })
    const stateRepository = createFakePayrollStateRepository()
    const crediter = createFakeSalaryCrediter()
    const failingCrediter = {
      async credit(userId: string, amount: number) {
        if (userId === 'user-a') {
          throw new Error('motor fora do ar')
        }
        await crediter.credit(userId, amount)
      },
    }
    const creditForUser = new CreditMonthlyPayrollForUserUseCase(
      levelReader,
      stateRepository,
      failingCrediter,
    )
    const useCase = new RunPayrollCheckUseCase(userDirectory, calendarReader, creditForUser, 3)

    const result = await useCase.execute()

    expect(result).toEqual({ usersChecked: 2, usersPaid: 1, monthsPaidTotal: 1 })
    expect(crediter.credits).toEqual([{ userId: 'user-b', amount: 1000 }])
  })
})
