import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import { createGracefulShutdown } from './gracefulShutdown'

function listen(handler: Parameters<typeof createServer>[1]) {
  const server = createServer(handler)
  return new Promise<{ server: typeof server; port: number }>((resolve) => {
    server.listen(0, () => resolve({ server, port: (server.address() as AddressInfo).port }))
  })
}

describe('createGracefulShutdown', () => {
  it('espera a requisição em andamento, para os agendadores e só então fecha os recursos', async () => {
    const order: string[] = []
    let release: () => void = () => {}
    const { server, port } = await listen((_req, res) => {
      order.push('requisição iniciada')
      release = () => res.end('ok')
    })
    const tick = vi.fn()
    const timer = setInterval(tick, 10)
    const exit = vi.fn(() => order.push('exit'))
    const shutdown = createGracefulShutdown({
      server,
      timers: () => [timer],
      resources: () => [{ name: 'banco', close: () => void order.push('banco fechado') }],
      timeoutMs: 2000,
      log: () => {},
      exit,
    })

    const response = fetch(`http://127.0.0.1:${port}/`, { headers: { connection: 'close' } }).then(
      (r) => r.text(),
    )
    await vi.waitFor(() => expect(order).toContain('requisição iniciada'))

    const done = shutdown('SIGTERM')
    await new Promise((r) => setTimeout(r, 50))
    expect(order).not.toContain('banco fechado')
    release()

    await expect(response).resolves.toBe('ok')
    await done
    const calls = tick.mock.calls.length
    await new Promise((r) => setTimeout(r, 40))
    expect(tick.mock.calls.length).toBe(calls)
    expect(order).toEqual(['requisição iniciada', 'banco fechado', 'exit'])
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('corta as conexões e sai com código 1 quando a requisição passa do teto', async () => {
    const { server, port } = await listen(() => {})
    const exit = vi.fn()
    const close = vi.fn()
    const shutdown = createGracefulShutdown({
      server,
      timers: () => [],
      resources: () => [{ name: 'banco', close }],
      timeoutMs: 50,
      log: () => {},
      exit,
    })
    const hung = fetch(`http://127.0.0.1:${port}/`).catch(() => 'cortada')
    await new Promise((r) => setTimeout(r, 30))
    await shutdown('SIGTERM')
    await expect(hung).resolves.toBe('cortada')
    expect(close).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('ignora um segundo sinal e segue fechando os demais recursos se um falhar', async () => {
    const { server } = await listen((_req, res) => res.end())
    const exit = vi.fn()
    const second = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const shutdown = createGracefulShutdown({
      server,
      timers: () => [],
      resources: () => [
        { name: 'Redis', close: () => Promise.reject(new Error('boom')) },
        { name: 'banco', close: second },
      ],
      timeoutMs: 1000,
      log: () => {},
      exit,
    })
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')])
    expect(second).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(1)
  })
})
