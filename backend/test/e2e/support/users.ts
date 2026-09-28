import { randomUUID } from 'node:crypto'
import { api } from './http'

export interface E2EUser {
  token: string
  userId: string
}

// Cadastro real via HTTP (não fake/fixture) — usuário/senha aleatórios por
// execução, mesmo padrão já aceito em toda validação manual anterior
// (usuários de teste ficam no banco de dev, README explica o motivo).
export async function registerRandomUser(): Promise<E2EUser> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const res = await api()
    .post('/auth/register')
    .send({
      name: `E2E ${suffix}`,
      email: `e2e-${suffix}@example.com`,
      username: `e2e_${suffix}`,
      password: 'SenhaForte123!',
    })

  if (res.status !== 201) {
    throw new Error(`falha ao registrar usuário e2e: ${res.status} ${JSON.stringify(res.body)}`)
  }

  return { token: res.body.token as string, userId: res.body.user.id as string }
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
