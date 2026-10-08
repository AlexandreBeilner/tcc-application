import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEngineEventsExportSource,
  createEngineOrdersExportSource,
} from './engineExportSource'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineExportSource', () => {
  it('ordens: repassa período e teto e achata as colunas, sem nome nem e-mail', async () => {
    respond(200, {
      truncated: true,
      rows: [
        {
          id: 'o1',
          user_id: 'u1',
          is_bot: false,
          ticker: 'ACME3',
          side: 'buy',
          type: 'limit',
          quantity: 10,
          filled_quantity: 4,
          price: '12.50',
          status: 'partially_filled',
          cancel_reason: null,
          simulated_day: 3,
          created_at: '2026-10-01T10:00:00Z',
        },
      ],
    })
    const table = await createEngineOrdersExportSource('http://engine:8080').fetch(
      { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-02T00:00:00Z') },
      500,
    )

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/admin/export/orders')
    expect(url.searchParams.get('limit')).toBe('500')
    expect(url.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z')
    expect(url.searchParams.get('to')).toBe('2026-10-02T00:00:00.000Z')
    expect(table.truncated).toBe(true)
    expect(table.columns).toHaveLength(13)
    expect(table.columns).not.toContain('email')
    expect(table.rows[0]).toEqual([
      'o1',
      'u1',
      false,
      'ACME3',
      'buy',
      'limit',
      10,
      4,
      '12.50',
      'partially_filled',
      null,
      3,
      '2026-10-01T10:00:00Z',
    ])
  })

  it('eventos: lê /admin/export/events e mantém nulos', async () => {
    respond(200, {
      truncated: false,
      rows: [
        {
          id: 'e1',
          user_id: 'u1',
          is_bot: true,
          ticker: null,
          event_type: 'initial_deposit',
          quantity: null,
          unit_value: '10000.00',
          simulated_day: 0,
          timestamp: '2026-10-01T10:00:00Z',
        },
      ],
    })
    const table = await createEngineEventsExportSource('http://engine:8080').fetch({}, 100)

    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/admin/export/events')
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has('from')).toBe(false)
    expect(table.rows[0]).toEqual([
      'e1',
      'u1',
      true,
      null,
      'initial_deposit',
      null,
      '10000.00',
      0,
      '2026-10-01T10:00:00Z',
    ])
  })

  it('falha do motor lança erro', async () => {
    respond(500, {})
    await expect(
      createEngineOrdersExportSource('http://engine:8080').fetch({}, 10),
    ).rejects.toThrow(/status 500/)
  })
})
