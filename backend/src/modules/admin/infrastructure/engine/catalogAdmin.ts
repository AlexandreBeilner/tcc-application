import { CatalogAssetNotFoundError, CatalogAssetRejectedError } from '../../domain/errors'
import type { CatalogAdmin, CatalogAsset } from '../../application/ports/catalogAdmin'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createCatalogAdmin(engineUrl: string): CatalogAdmin {
  return {
    async list() {
      const res = await fetch(`${engineUrl}/admin/catalog`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`falha ao ler o catálogo no motor de simulação (status ${res.status})`)
      }
      return ((await res.json()) as { assets: CatalogAsset[] }).assets
    },

    async update(assetId, patch, adminId) {
      const res = await fetch(`${engineUrl}/admin/catalog/${encodeURIComponent(assetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, admin_id: adminId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 404) {
        throw new CatalogAssetNotFoundError(await errorMessage(res, 'ativo não encontrado'))
      }
      if (res.status === 422) {
        throw new CatalogAssetRejectedError(
          await errorMessage(res, 'alteração recusada pelo motor'),
        )
      }
      if (!res.ok) {
        throw new Error(`falha ao gravar o ativo no motor de simulação (status ${res.status})`)
      }
      return (await res.json()) as CatalogAsset
    },
  }
}
