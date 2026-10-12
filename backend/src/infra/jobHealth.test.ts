import { beforeEach, describe, expect, it } from 'vitest'
import {
  getJobsHealth,
  recordJobFailure,
  recordJobSuccess,
  registerJob,
  resetJobHealthForTests,
} from './jobHealth'

const HOUR = 3_600_000
let now = 0

beforeEach(() => {
  now = 1_000_000
  resetJobHealthForTests(() => now)
})

describe('jobHealth', () => {
  it('um job recém-registrado está ok', () => {
    registerJob('ranking', 3 * HOUR)
    expect(getJobsHealth(now)[0].status).toBe('ok')
  })

  it('fica atrasado quando passa de 3 intervalos sem sucesso', () => {
    registerJob('ranking', 3 * HOUR)
    expect(getJobsHealth(now + 9 * HOUR)[0].status).toBe('ok')
    expect(getJobsHealth(now + 9 * HOUR + 1)[0].status).toBe('atrasado')
  })

  it('um sucesso zera o atraso e as falhas', () => {
    registerJob('ranking', HOUR)
    now += 10 * HOUR
    recordJobFailure('ranking')
    recordJobSuccess('ranking')
    const [job] = getJobsHealth(now)
    expect(job.status).toBe('ok')
    expect(job.consecutiveFailures).toBe(0)
    expect(job.lastSuccessAt).not.toBeNull()
  })

  it('3 falhas seguidas viram "falhando" mesmo dentro do prazo', () => {
    registerJob('email-outbox', HOUR)
    recordJobFailure('email-outbox')
    recordJobFailure('email-outbox')
    expect(getJobsHealth(now)[0].status).toBe('ok')
    recordJobFailure('email-outbox')
    expect(getJobsHealth(now)[0].status).toBe('falhando')
  })

  it('ignora registro de job desconhecido', () => {
    recordJobSuccess('nao-existe')
    recordJobFailure('nao-existe')
    expect(getJobsHealth(now)).toEqual([])
  })
})
