export class EmailAlreadyInUseError extends Error {}
export class UsernameAlreadyInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class UserNotFoundError extends Error {}
// Tarefa 6.10.8 — tipo de arquivo fora da lista permitida ou maior que o
// limite (`uploadAvatar.ts`).
export class InvalidAvatarFileError extends Error {}
