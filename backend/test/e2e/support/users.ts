import { randomUUID } from 'node:crypto'
import { withE2EDatabase } from './db'
import { api } from './http'

export interface E2EUser {
  token: string
  userId: string
}

// Conta nova só entra com o e-mail verificado (EM.3.1, D2) e o link vai por e-mail, que a suíte
// não lê. O e2e confirma a conta direto no banco de dev (mesmo `DATABASE_URL` do seed do admin)
// e faz o login de verdade pelo gateway: o resto da jornada continua HTTP real.
async function markEmailVerified(userId: string): Promise<void> {
  await withE2EDatabase((client) =>
    client.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [userId]),
  )
}

// Cadastro real via HTTP (não fake/fixture) — usuário/senha aleatórios por
// execução, mesmo padrão já aceito em toda validação manual anterior
// (usuários de teste ficam no banco de dev, README explica o motivo).
export async function registerRandomUser(): Promise<E2EUser> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `e2e-${suffix}@example.com`
  const password = 'SenhaForte123!'
  const res = await api()
    .post('/auth/register')
    .send({ name: `E2E ${suffix}`, email, username: `e2e_${suffix}`, password })

  if (res.status !== 201) {
    throw new Error(`falha ao registrar usuário e2e: ${res.status} ${JSON.stringify(res.body)}`)
  }
  const userId = res.body.user.id as string
  await markEmailVerified(userId)

  const login = await api().post('/auth/login').send({ email, password })
  if (login.status !== 200) {
    throw new Error(`falha ao logar usuário e2e: ${login.status} ${JSON.stringify(login.body)}`)
  }
  return { token: login.body.token as string, userId }
}

// Login do admin pré-seedado (npm run db:seed:admin, README desta suíte) —
// role = admin nunca é atribuível por autocadastro (RNF07/CLAUDE.md), então
// a suíte não pode criar o próprio admin, só autenticar contra um já
// existente no banco de dev.
export async function loginAsAdmin(): Promise<string> {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error(
      'defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD (credenciais de um usuário role=admin já ' +
        'seedado via npm run db:seed:admin) antes de rodar a suíte e2e — ver test/e2e/README.md',
    )
  }

  const res = await api().post('/auth/login').send({ email, password })
  if (res.status !== 200) {
    throw new Error(`falha ao logar como admin e2e: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.token as string
}
