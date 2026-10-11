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
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new EngineGovernanceError(res.status, body.error ?? 'erro do motor de simulação')
  }
  return (await res.json()) as T
}
