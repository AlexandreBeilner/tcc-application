import { z } from 'zod'

// Mesma paginação de GET /admin/macro-events (tarefa 4.5) — duplicada aqui
// de propósito: cada módulo mantém seu próprio schemas.ts (padrão do resto
// do backend), em vez de importar de modules/admin/interfaces/http.
export const newsFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
