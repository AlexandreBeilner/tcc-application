import { describe, expect, it } from 'vitest'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeExportSource } from '../../test/fakes/fakeExportSource'
import {
  clampExportLimit,
  DEFAULT_EXPORT_ROWS,
  ExportCsvUseCase,
  MAX_EXPORT_ROWS,
} from './exportCsv'
import { RecordAdminActionUseCase } from './recordAdminAction'

function build() {
  const users = createFakeExportSource()
  const orders = createFakeExportSource({ columns: ['id'], rows: [['o1']] })
  const events = createFakeExportSource()
  const audit = createFakeExportSource()
  const auditLog = createFakeAuditLogRepository()
  const useCase = new ExportCsvUseCase(
    { users, orders, 'market-events': events, 'audit-log': audit },
    new RecordAdminActionUseCase(auditLog),
    () => new Date('2026-10-06T15:00:00Z'),
  )
  return { users, orders, auditLog, useCase }
}

describe('clampExportLimit', () => {
  it.each([
    [undefined, DEFAULT_EXPORT_ROWS],
    [0, DEFAULT_EXPORT_ROWS],
    [25, 25],
    [MAX_EXPORT_ROWS, MAX_EXPORT_ROWS],
    [MAX_EXPORT_ROWS + 1, MAX_EXPORT_ROWS],
  ])('%s vira %s', (requested, expected) => {
    expect(clampExportLimit(requested)).toBe(expected)
  })
})

describe('ExportCsvUseCase', () => {
  it('monta o CSV com BOM, neutraliza fórmula e nomeia o arquivo pelo conjunto e pelo dia', async () => {
    const { useCase, users } = build()

    const result = await useCase.execute('admin-1', 'users', {})

    expect(result.filename).toBe('users-20261006.csv')
    expect(result.rows).toBe(2)
    expect(result.truncated).toBe(false)
    // A fórmula ganha apóstrofo (CSV injection) e, por ter aspas, vai entre aspas com elas dobradas.
    expect(result.csv).toBe(`\uFEFFid,name\r\n1,Ana\r\n2,"'=HYPERLINK(""http://x"")"\r\n`)
    expect(users.calls[0]?.limit).toBe(DEFAULT_EXPORT_ROWS)
  })

  it('repassa o período e o teto à fonte certa e nunca passa do máximo', async () => {
    const { useCase, orders, users } = build()
    const from = new Date('2026-10-01T00:00:00Z')

    await useCase.execute('admin-1', 'orders', { from }, 10_000_000)

    expect(orders.calls[0]).toEqual({ range: { from }, limit: MAX_EXPORT_ROWS })
    expect(users.calls).toHaveLength(0)
  })

  it('audita export.csv com conjunto, período, teto, linhas e truncamento', async () => {
    const { useCase, auditLog } = build()

    await useCase.execute(
      'admin-1',
      'orders',
      {
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
      },
      50,
    )

    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'export.csv',
      targetType: 'export',
      targetId: 'orders',
      result: 'success',
      payload: {
        dataset: 'orders',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-02T00:00:00.000Z',
        limit: 50,
        rows: 1,
        truncated: false,
      },
    })
  })

  it('fonte truncada marca o resultado e a auditoria', async () => {
    const { useCase, orders, auditLog } = build()
    orders.table = { ...orders.table, truncated: true }
    const result = await useCase.execute('admin-1', 'orders', {})
    expect(result.truncated).toBe(true)
    expect(auditLog.entries[0]?.payload).toMatchObject({ truncated: true })
  })

  it('falha da fonte é auditada como failed e relançada', async () => {
    const { useCase, users, auditLog } = build()
    users.errorToThrow = new Error('banco fora')
    await expect(useCase.execute('admin-1', 'users', {})).rejects.toThrow('banco fora')
    expect(auditLog.entries[0]).toMatchObject({ action: 'export.csv', result: 'failed' })
  })
})
