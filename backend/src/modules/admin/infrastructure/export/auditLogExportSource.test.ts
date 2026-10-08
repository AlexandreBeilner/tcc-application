import { describe, expect, it } from 'vitest'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createAuditLogExportSource } from './auditLogExportSource'

async function seed(count: number) {
  const auditLog = createFakeAuditLogRepository()
  for (let i = 0; i < count; i++) {
    await auditLog.append({
      adminId: 'admin-1',
      action: 'tick.trigger',
      targetType: 'tick',
      payload: { n: i },
      result: 'success',
    })
  }
  return auditLog
}

describe('auditLogExportSource', () => {
  it('exporta as colunas do log com o payload em JSON', async () => {
    const source = createAuditLogExportSource(await seed(1))
    const table = await source.fetch({}, 10)
    expect(table.columns).toContain('payload')
    expect(table.rows[0]?.[4]).toBe('tick.trigger')
    expect(table.rows[0]?.at(-1)).toBe('{"n":0}')
    expect(table.truncated).toBe(false)
  })

  it('pede uma linha a mais pra saber se truncou e entrega só o limite', async () => {
    const source = createAuditLogExportSource(await seed(5))
    const table = await source.fetch({}, 3)
    expect(table.rows).toHaveLength(3)
    expect(table.truncated).toBe(true)
  })

  it('no limite exato não marca truncado', async () => {
    const source = createAuditLogExportSource(await seed(3))
    expect((await source.fetch({}, 3)).truncated).toBe(false)
  })
})
