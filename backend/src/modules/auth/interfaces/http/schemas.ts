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
  // Código do link de indicação (MO.7.2): formato errado não recusa o cadastro, só é ignorado.
  referralCode: z.string().trim().max(32).optional(),
})

export const loginBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
})

export const googleTokenBodySchema = z.object({
  idToken: z.string().min(1),
  referralCode: z.string().trim().max(32).optional(),
})

export const reauthBodySchema = z.object({
  password: z.string().min(1),
})

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_]+$/, 'use apenas letras minúsculas, números e "_"')
      .optional(),
    onboardingCompleted: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.username !== undefined ||
      data.onboardingCompleted !== undefined,
    {
      message: 'informe ao menos um campo pra atualizar',
    },
  )

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(72),
})

export const forgotPasswordBodySchema = z.object({
  email: z.email().trim().toLowerCase().max(100),
})

export const resetPasswordBodySchema = z.object({
  // O token tem 43 caracteres (32 bytes em base64url); o teto só barra lixo grande.
  token: z.string().trim().min(1).max(200),
  // Mesma regra do cadastro e da troca de senha: 8 a 72 (limite do bcrypt).
  newPassword: z.string().min(8).max(72),
})

export const verifyEmailBodySchema = z.object({
  // Mesmo formato do token de reset: 43 caracteres, teto só barra lixo grande.
  token: z.string().trim().min(1).max(200),
})

export const resendVerificationBodySchema = z.object({
  email: z.email().trim().toLowerCase().max(100),
})
