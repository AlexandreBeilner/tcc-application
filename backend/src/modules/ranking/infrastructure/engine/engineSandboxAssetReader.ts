import type { SandboxAssetReader } from '../../application/ports/sandboxAssetReader'

interface AssetResponse {
  id: string
  is_sandbox: boolean
}

export function createEngineSandboxAssetReader(engineUrl: string): SandboxAssetReader {
  return {
    async listSandboxAssetIds(): Promise<Set<string>> {
      const res = await fetch(`${engineUrl}/assets`)
      if (!res.ok) {
        throw new Error(`falha ao ler catálogo no motor de simulação (status ${res.status})`)
      }

      const assets = (await res.json()) as AssetResponse[]
      return new Set(assets.filter((asset) => asset.is_sandbox).map((asset) => asset.id))
    },
  }
}
