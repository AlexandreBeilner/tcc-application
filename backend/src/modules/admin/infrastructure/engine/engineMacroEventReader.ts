import type {
  ListMacroEventsQuery,
  ListMacroEventsResult,
  MacroEventReader,
} from '../../application/ports/macroEventReader'

export function createEngineMacroEventReader(engineUrl: string): MacroEventReader {
  return {
    async list(query: ListMacroEventsQuery): Promise<ListMacroEventsResult> {
      const params = new URLSearchParams()
      if (query.limit !== undefined) params.set('limit', String(query.limit))
      if (query.offset !== undefined) params.set('offset', String(query.offset))
      // Filtros do painel (N.11): repassados como vieram, o motor valida e aplica.
      for (const key of [
        'view',
        'status',
        'sector',
        'risk_class',
        'asset_id',
        'from_day',
        'to_day',
      ] as const) {
        const value = query[key]
        if (value !== undefined) params.set(key, String(value))
      }
      const qs = params.toString()

      const res = await fetch(`${engineUrl}/macro-events${qs ? `?${qs}` : ''}`)
      if (!res.ok) {
        throw new Error(
          `falha ao listar eventos macro no motor de simulação (status ${res.status})`,
        )
      }

      return (await res.json()) as ListMacroEventsResult
    },
  }
}
