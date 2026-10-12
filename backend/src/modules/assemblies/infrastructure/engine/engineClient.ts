import { GovernanceEngineUnavailableError } from '../../domain/errors'

// Chamada ao motor (rede interna do Compose) com erro legível. Falha de rede propaga como
// rejeição comum; o job do ciclo trata por item e tenta de novo na rodada seguinte.
export class EngineGovernanceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function engineJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    throw new GovernanceEngineUnavailableError(
      `motor de simulação inacessível: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    const message = body.error ?? 'erro do motor de simulação'
    if (res.status >= 500) throw new GovernanceEngineUnavailableError(message)
    throw new EngineGovernanceError(res.status, message)
  }
  return (await res.json()) as T
}
