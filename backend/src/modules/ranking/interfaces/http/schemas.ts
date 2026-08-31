import { z } from 'zod'

// `window` só é opcional quando `criterion === 'level'` (nível é
// cumulativo desde sempre, não usa janela — 6.8.3) — o `refine` abaixo
// mantém `window` obrigatório pros outros 3 critérios, preservando o
// comportamento de validação que já existia antes da 6.8.3.
export const rankingQuerySchema = z
  .object({
    window: z.enum(['week', 'month']).optional(),
    scope: z.enum(['global', 'friends']).default('global'),
    criterion: z.enum(['overall', 'fixedIncome', 'variableIncome', 'level']).default('overall'),
    // Paginação (6.8.2) — página 1-based, tamanho fixo em 25
    // (`RANKING_PAGE_SIZE`, não é um parâmetro de query).
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((data) => data.criterion === 'level' || data.window !== undefined, {
    message: 'window é obrigatório exceto quando criterion=level',
    path: ['window'],
  })
