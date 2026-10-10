import { z } from 'zod'

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export const createLeagueBodySchema = z.object({
  name: z.string().min(1).max(100),
  window: z.enum(['week', 'month']),
})

export const renameLeagueBodySchema = z.object({
  name: z.string().min(1).max(100),
})

export const inviteBodySchema = z.object({
  userId: uuid,
})

export const invitationResponseBodySchema = z.object({
  accept: z.boolean(),
})
