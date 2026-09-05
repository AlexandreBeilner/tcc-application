import { buildAvatarUrl } from '../../../../shared/avatarUrl'
import type { User } from '../../domain/user'

// Único serializador de usuário público pra `modules/auth` — usado por
// authRouter (register/login/me) e accountRouter (PATCH /me, POST /me/avatar)
// pra manter as respostas consistentes num só lugar (.docs/backend/auth.md
// documenta o formato como uniforme entre as rotas). `avatarUrl` (tarefa
// 6.10.8) nunca expõe `avatarPath` cru — só a URL pública já resolvida.
export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    onboardingCompleted: user.onboardingCompleted,
    avatarUrl: buildAvatarUrl(user.avatarPath),
  }
}
