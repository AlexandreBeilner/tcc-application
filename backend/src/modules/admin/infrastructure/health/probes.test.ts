import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { createMarketDatabaseProbe, createRedisProbe } from './probes'

function fakeRedis(status: string, reply = 'PONG') {
  const connect = vi.fn().mockResolvedValue(undefined)
  const ping = vi.fn().mockResolvedValue(reply)
  return { redis: { status, connect, ping } as unknown as Redis, connect, ping }
}

describe('createRedisProbe', () => {
  it('conecta antes do PING quando o cliente ainda não conectou (lazy, sem fila offline)', async () => {
    const { redis, connect, ping } = fakeRedis('wait')
    await createRedisProbe(redis).check()
    expect(connect).toHaveBeenCalledOnce()
    expect(ping).toHaveBeenCalledOnce()
  })

  it('não reconecta um cliente que já está pronto', async () => {
    const { redis, connect } = fakeRedis('ready')
    await createRedisProbe(redis).check()
    expect(connect).not.toHaveBeenCalled()
  })

  it('resposta diferente de PONG é falha', async () => {
    const { redis } = fakeRedis('ready', 'ERRO')
    await expect(createRedisProbe(redis).check()).rejects.toThrow('resposta inesperada')
  })
})

describe('createMarketDatabaseProbe', () => {
  it('passa quando a leitura da visão geral do motor responde e propaga a falha', async () => {
    const get = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('banco fora'))
    const probe = createMarketDatabaseProbe({ get })
    await expect(probe.check()).resolves.toBeUndefined()
    await expect(probe.check()).rejects.toThrow('banco fora')
  })
})
