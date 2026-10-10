export class EmailAlreadyInUseError extends Error {}
export class UsernameAlreadyInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class UserNotFoundError extends Error {}
// Conta suspensa pelo painel admin (N.16): não loga nem usa token.
export class AccountSuspendedError extends Error {}
// Tarefa 6.10.8 — tipo de arquivo fora da lista permitida ou maior que o
// limite (`uploadAvatar.ts`).
export class InvalidAvatarFileError extends Error {}
// Token de e-mail (reset de senha) desconhecido, expirado ou já usado (EM.2.1). `reason` deixa a
// borda HTTP separar "não existe" (401) de "venceu ou já foi usado" (410).
export class InvalidEmailTokenError extends Error {
  constructor(readonly reason: 'invalid' | 'expired' | 'used') {
    super(`token de e-mail ${reason}`)
  }
}
// Senha conferiu, mas a conta criada por e-mail e senha ainda não confirmou o e-mail (EM.3.1, D2).
export class EmailNotVerifiedError extends Error {}
// Login com Google cujo e-mail o próprio Google não verificou: não pode se vincular a conta existente (EM.3.2).
export class GoogleEmailNotVerifiedError extends Error {}
