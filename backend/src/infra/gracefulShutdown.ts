import type { Server } from 'node:http'

type Closeable = { name: string; close: () => Promise<unknown> | unknown }

export type GracefulShutdownDeps = {
  server: Pick<Server, 'close' | 'closeIdleConnections' | 'closeAllConnections'>
  // Agendadores (`setInterval`): parados primeiro, pra nenhum job novo começar durante o encerramento.
  timers: () => NodeJS.Timeout[]
  // Pool do Postgres, Redis etc.: fechados só depois que as requisições em andamento terminaram.
  resources: () => Closeable[]
  // Teto de espera pelas requisições; passou disso, as conexões restantes são cortadas.
  timeoutMs: number
  log?: (message: string) => void
  exit: (code: number) => void
}

// Encerramento limpo (LW.3.14): `docker stop` manda SIGTERM e, passados 10 s, SIGKILL. A ordem é
// parar de aceitar conexões, deixar as requisições em andamento terminarem, parar os agendadores e
// só então fechar banco e Redis. Chamadas repetidas (SIGTERM seguido de SIGINT) são ignoradas.
export function createGracefulShutdown(deps: GracefulShutdownDeps) {
  const log = deps.log ?? ((message: string) => console.log(message))
  let started = false

  return async function shutdown(signal: string): Promise<void> {
    if (started) return
    started = true
    log(`encerrando (${signal}): parando de aceitar conexões`)

    for (const timer of deps.timers()) clearInterval(timer)

    let exitCode = 0
    const drained = new Promise<void>((resolve) => {
      deps.server.close((err) => {
        if (err) exitCode = 1
        resolve()
      })
      // Conexões keep-alive ociosas seguram o `close`; as ativas continuam até responder.
      deps.server.closeIdleConnections()
    })
    const timedOut = new Promise<'timeout'>((resolve) => {
      const timeout = setTimeout(() => resolve('timeout'), deps.timeoutMs)
      timeout.unref()
    })
    if ((await Promise.race([drained.then(() => 'drained' as const), timedOut])) === 'timeout') {
      log('encerramento: requisições demoraram demais, cortando as conexões restantes')
      deps.server.closeAllConnections()
      exitCode = 1
    }

    for (const resource of deps.resources()) {
      try {
        await resource.close()
      } catch (err) {
        exitCode = 1
        console.error(`encerramento: erro ao fechar ${resource.name}`, err)
      }
    }
    log('encerramento concluído')
    deps.exit(exitCode)
  }
}
