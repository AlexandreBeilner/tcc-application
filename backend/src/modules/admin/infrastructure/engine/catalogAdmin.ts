import {
  CatalogAssetConflictError,
  CatalogAssetNotFoundError,
  CatalogAssetPartialError,
  CatalogAssetRejectedError,
} from '../../domain/errors'
import type {
  CatalogAdmin,
  CatalogAsset,
  CreatedCatalogAsset,
  NewCatalogAssetPreview,
} from '../../application/ports/catalogAdmin'

const REQUEST_TIMEOUT_MS = 4000
const CREATE_TIMEOUT_MS = 30000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

async function engineError(
  res: Response,
): Promise<{ error?: string; field?: string; asset_id?: string }> {
  return (await res.json().catch(() => ({}))) as {
    error?: string
    field?: string
    asset_id?: string
  }
}

export function createCatalogAdmin(engineUrl: string): CatalogAdmin {
  // Traduz as recusas do cadastro (preview e create): 409 colisão, 422 regra de domínio com o
  // campo, 500 com asset_id quando o catálogo já gravou.
  async function readNewAsset<T>(res: Response, failure: string): Promise<T> {
    if (res.ok) return (await res.json()) as T
    const body = await engineError(res)
    if (res.status === 409)
      throw new CatalogAssetConflictError(body.error ?? 'ticker ou CNPJ já em uso')
    if (res.status === 422) {
      throw new CatalogAssetRejectedError(body.error ?? 'cadastro recusado pelo motor', body.field)
    }
    if (res.status === 500 && body.asset_id) {
      throw new CatalogAssetPartialError(body.error ?? failure, body.asset_id)
    }
    throw new Error(`${failure} (status ${res.status})`)
  }

  const post = (path: string, body: unknown) =>
    fetch(`${engineUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // O cadastro grava catálogo, bots e posições de um float inteiro: mais lento que um PATCH.
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    })

  return {
    async preview(asset) {
      const res = await post('/admin/catalog/preview', asset)
      return readNewAsset<NewCatalogAssetPreview>(
        res,
        'falha ao simular o cadastro no motor de simulação',
      )
    },

    async create(asset, adminId) {
      const res = await post('/admin/catalog', { ...asset, admin_id: adminId })
      return readNewAsset<CreatedCatalogAsset>(
        res,
        'falha ao cadastrar o ativo no motor de simulação',
      )
    },

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
