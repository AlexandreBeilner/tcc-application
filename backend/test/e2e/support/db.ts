import { Client } from 'pg'

// Banco de gamificação da stack sob teste (README desta suíte). A suíte só lê ou escreve nele o
// que não tem caminho HTTP por desenho: confirmar o e-mail (o link vai por e-mail) e ler o
// gabarito das perguntas da lição (nunca sai do servidor antes do acerto).
export async function withE2EDatabase<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgres://tcc:tcc@localhost:5432/gamification',
  })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}
