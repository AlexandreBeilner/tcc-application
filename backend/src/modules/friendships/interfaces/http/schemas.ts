import { z } from 'zod'

export const searchUsersQuerySchema = z.object({
  q: z.string().min(1, 'informe ao menos 1 caractere'),
})

export const sendFriendRequestBodySchema = z.object({
  addresseeUsername: z.string().min(1),
})
