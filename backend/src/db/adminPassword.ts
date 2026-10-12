// Origem da senha do administrador no seed (LW.3.14). Em produção a senha não pode ir na linha de
// comando nem numa variável de ambiente exportada no shell (fica no histórico), então, na ordem:
//   1. ADMIN_PASSWORD_FILE: caminho de um arquivo com a senha (apagar depois);
//   2. ADMIN_PASSWORD: só para desenvolvimento (recusada com NODE_ENV=production);
//   3. terminal interativo: pergunta sem mostrar o que se digita;
//   4. entrada padrão ligada a um pipe (`... | node dist/db/seed.js`).
export interface AdminPasswordDeps {
  env: Record<string, string | undefined>
  readFile: (path: string) => Promise<string>
  isTty: boolean
  promptHidden: (question: string) => Promise<string>
  readStdin: () => Promise<string>
}

export class AdminPasswordUnavailableError extends Error {}

function clean(raw: string): string {
  // Arquivo e pipe costumam terminar em quebra de linha; a senha em si não leva.
  return raw.replace(/\r?\n$/, '')
}

export async function resolveAdminPassword(deps: AdminPasswordDeps): Promise<string> {
  const { env } = deps
  if (env.ADMIN_PASSWORD_FILE) {
    const password = clean(await deps.readFile(env.ADMIN_PASSWORD_FILE))
    if (!password) throw new AdminPasswordUnavailableError('o arquivo da senha está vazio')
    return password
  }
  if (env.ADMIN_PASSWORD) {
    if (env.NODE_ENV === 'production') {
      throw new AdminPasswordUnavailableError(
        'em produção use ADMIN_PASSWORD_FILE ou digite a senha no terminal; ADMIN_PASSWORD fica no histórico do shell',
      )
    }
    return env.ADMIN_PASSWORD
  }
  const password = clean(
    deps.isTty ? await deps.promptHidden('Senha do administrador: ') : await deps.readStdin(),
  )
  if (!password) throw new AdminPasswordUnavailableError('nenhuma senha informada')
  return password
}
