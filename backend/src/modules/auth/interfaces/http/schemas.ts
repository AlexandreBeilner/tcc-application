import { z } from 'zod'

export const registerBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase().max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, 'use apenas letras minúsculas, números e "_"'),
  // max(72): bcrypt ignora silenciosamente bytes além do 72º — rejeitar
  // aqui em vez de truncar sem avisar.
  password: z.string().min(8).max(72),
})

export const loginBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
})

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.email().trim().toLowerCase().max(100).optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_]+$/, 'use apenas letras minúsculas, números e "_"')
      .optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.email !== undefined || data.username !== undefined,
    {
      message: 'informe ao menos um campo pra atualizar',
    },
  )

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(72),
})
