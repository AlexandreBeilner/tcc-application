const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:8080'

export async function checkEngineHealth(): Promise<'ok' | 'unreachable'> {
  try {
    const res = await fetch(`${ENGINE_URL}/health`)
    if (!res.ok) return 'unreachable'
    const body = (await res.json()) as { status?: string }
    return body.status === 'ok' ? 'ok' : 'unreachable'
  } catch {
    return 'unreachable'
  }
}
