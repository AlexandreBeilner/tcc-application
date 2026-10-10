import { z } from 'zod'

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export const createDuelBodySchema = z.object({ opponentId: uuid })
export const duelResponseBodySchema = z.object({ accept: z.boolean() })
