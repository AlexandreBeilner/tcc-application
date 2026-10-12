// Registro dos recursos que precisam ser fechados no encerramento (pool do Postgres, Redis).
// `createDb` e `createRedisClient` se registram aqui ao criar o recurso, então quem os cria
// (o `app.ts` e o `server.ts` criam pools separados) não precisa repassar o handle até o
// `server.ts` só para fechá-lo. Só o `server.ts` consome (`runShutdownHooks`).
type ShutdownHook = { name: string; close: () => Promise<unknown> | unknown }

const hooks: ShutdownHook[] = []

export function registerShutdownHook(name: string, close: ShutdownHook['close']): void {
  hooks.push({ name, close })
}

export function takeShutdownHooks(): ShutdownHook[] {
  return hooks.splice(0, hooks.length)
}
