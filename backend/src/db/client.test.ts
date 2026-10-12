import { describe, expect, it, vi } from 'vitest'
import { createDb } from './client'

describe('createDb', () => {
  it('trata o erro de conexão ociosa do pool em vez de derrubar o processo', () => {
    const db = createDb('postgres://u:p@127.0.0.1:1/x')
    const pool = (db as unknown as { $client: import('pg').Pool }).$client
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(pool.listenerCount('error')).toBeGreaterThan(0)
    // Sem o ouvinte, este emit lançaria e o teste falharia (é o que mata o processo em produção).
    expect(() =>
      pool.emit('error', new Error('terminating connection due to administrator command')),
    ).not.toThrow()
    expect(log).toHaveBeenCalledWith('pool do Postgres: erro em conexão ociosa', expect.any(Error))
    log.mockRestore()
  })
})
