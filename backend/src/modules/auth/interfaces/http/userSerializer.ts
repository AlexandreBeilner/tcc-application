import type { User } from '../../domain/user'

// Único serializador de usuário público pra `modules/auth` — usado por
// authRouter (register/login/me) e accountRouter (PATCH /me) pra manter as
// respostas consistentes num só lugar (.docs/backend/auth.md documenta o
// formato como uniforme entre as rotas).
export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    onboardingCompleted: user.onboardingCompleted,
  }
}
