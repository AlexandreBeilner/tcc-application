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
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new EngineRequestError(res.status, body.error ?? 'erro do motor de simulação')
  }

  return (await res.json()) as T
}
