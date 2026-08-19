import type { AccountProvisioner } from '../../application/ports/accountProvisioner'

export function createEngineAccountProvisioner(engineUrl: string): AccountProvisioner {
  return {
    async provision(userId) {
      const res = await fetch(`${engineUrl}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      // 409 (conta já existe) não é falha aqui: pode acontecer numa
      // reexecução após timeout de rede, e o efeito desejado (conta aberta
      // com o capital inicial) já está garantido.
      if (!res.ok && res.status !== 409) {
        throw new Error(`falha ao abrir conta no motor de simulação (status ${res.status})`)
      }
    },
  }
}
