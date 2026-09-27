import { EngineRequestError } from '../../domain/errors'

// Helper compartilhado só dentro do módulo `market` (4 adapters de motor
// abaixo) — traduz qualquer resposta não-2xx do motor num
// `EngineRequestError` já com o status e a mensagem originais, repassados
// 1:1 pro cliente pelo router (tarefa 6.0.3). Falha de rede (motor fora do
// ar) não é capturada aqui — propaga como rejeição comum, cai no handler
// de erro padrão do Express (500), mesmo padrão dos outros módulos.
export async function engineFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = init ? await fetch(url, init) : await fetch(url)

  if (!res.ok) {
    const { error, ...details } = (await res.json().catch(() => ({}))) as {
      error?: string
      [key: string]: unknown
    }
    throw new EngineRequestError(res.status, error ?? 'erro do motor de simulação', details)
  }

  // 204 (ex: POST /orders/:id/cancel, tarefa O.1) não tem corpo — chamar
  // res.json() nesse caso rejeitaria por "Unexpected end of JSON input".
  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}
