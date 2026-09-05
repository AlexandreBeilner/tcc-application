import { paginate } from '../../../../shared/pagination'
import type { Snapshot } from '../../domain/networth'
import { profitabilityPct } from '../../domain/profitability'
import { windowFor, type WindowKind } from '../../domain/window'
import type { FriendGraphReader } from '../ports/friendGraphReader'
import type { LevelReader } from '../ports/levelReader'
import type { SandboxAssetReader } from '../ports/sandboxAssetReader'
import type { UserDirectory } from '../ports/userDirectory'
import type { NetWorthReader } from './getNetWorth'

export type RankingScope = 'global' | 'friends'

// Tarefa 6.8.3 — 4 critérios de ordenação, não só rentabilidade geral.
// `level` é arquiteturalmente diferente dos outros 3 (não usa janela, não
// chama o motor nenhuma vez) — ver comentário em `execute` sobre o
// caminho mais barato que ele segue.
export type RankingCriterion = 'overall' | 'fixedIncome' | 'variableIncome' | 'level'

// Página fixa de 25 (backlog 6.8.2) — não é um parâmetro de query
// configurável, é convenção de produto.
export const RANKING_PAGE_SIZE = 25

export interface GetRankingInput {
  // Opcional só porque `criterion: 'level'` ignora janela por completo
  // (nível é cumulativo desde sempre) — obrigatório pros outros 3
  // critérios, validado na borda HTTP (`schemas.ts`).
  window?: WindowKind
  scope: RankingScope
  criterion: RankingCriterion
  page: number
  requestingUserId: string
}

export interface RankingEntry {
  userId: string
  username: string
  level: number
  // Sempre presente (mesma leitura de `user_progression` que já traz
  // `level`) — só usado como critério de ordenação quando
  // `criterion === 'level'`, mas exposto sempre pra não obrigar o
  // frontend a lidar com dois shapes de resposta diferentes.
  xp: number
  // Único dado financeiro exposto — nunca patrimônio absoluto (RNF09).
  // `null` quando `criterion === 'level'` (rentabilidade não entra nesse
  // critério).
  profitabilityPct: number | null
}

export interface GetRankingResult {
  // Ecoa o input; irrelevante (mas presente) quando `criterion === 'level'`.
  window: WindowKind | null
  scope: RankingScope
  criterion: RankingCriterion
  entries: RankingEntry[]
  // Posição (1-based) do usuário que fez a requisição na lista ordenada
  // e filtrada pelo critério ativo — independe da página pedida, pra
  // sustentar "você está em 47º" mesmo fora da página exibida.
  requestingUserPosition: number | null
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
}

interface ScoredEntry {
  userId: string
  username: string
  level: number
  xp: number
  profitabilityPct: number | null
  // Chave de ordenação — `profitabilityPct` pros 3 primeiros critérios,
  // `xp` pro critério `level`. Mantida separada de `profitabilityPct`
  // porque esse último é `null` no critério `level`.
  sortKey: number
}

// Escolhe, pra cada critério financeiro, qual par de campos do `Snapshot`
// alimenta `profitabilityPct` — achado da 6.8.3: nenhum dos dois caminhos
// que populam `Snapshot` (estado atual via motor, replay pro baseline) foi
// escrito só pensando em `total`, os três campos já existem hoje.
function snapshotField(criterion: 'overall' | 'fixedIncome' | 'variableIncome'): keyof Snapshot {
  switch (criterion) {
    case 'overall':
      return 'total'
    case 'fixedIncome':
      return 'fixedIncomeValue'
    case 'variableIncome':
      return 'variableIncomeValue'
  }
}

export class GetRankingUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly sandboxAssetReader: SandboxAssetReader,
    private readonly getNetWorth: NetWorthReader,
    private readonly levelReader: LevelReader,
    private readonly friendGraphReader: FriendGraphReader,
  ) {}

  async execute(input: GetRankingInput): Promise<GetRankingResult> {
    const [allUsers, friendIds] = await Promise.all([
      this.userDirectory.listAll(),
      input.scope === 'friends'
        ? this.friendGraphReader.listAcceptedFriendIds(input.requestingUserId)
        : Promise.resolve<string[]>([]),
    ])

    // Escopo Amigos nunca recalcula patrimônio de novo — só filtra {o
    // próprio usuário} ∪ friendIds antes de calcular, evitando o custo de
    // patrimônio de todo mundo pra uma lista que só mostra alguns.
    const scopedUsers =
      input.scope === 'friends'
        ? allUsers.filter(
            (user) => user.id === input.requestingUserId || friendIds.includes(user.id),
          )
        : allUsers

    if (input.criterion !== 'level' && input.window === undefined) {
      // Guarda de runtime — a borda HTTP (`schemas.ts`) já valida isso via
      // Zod `.refine()`, mas `execute()` também é chamável direto (scripts,
      // outras rotas, testes), então o caso de uso não pode depender só da
      // validação de fora pra manter o invariante.
      throw new Error(`ranking: window é obrigatório para o critério "${input.criterion}"`)
    }

    const scoredEntries =
      input.criterion === 'level'
        ? await this.scoreByLevel(scopedUsers)
        : await this.scoreByProfitability(scopedUsers, input.criterion, input.window as WindowKind)

    scoredEntries.sort((a, b) => b.sortKey - a.sortKey)
    const requestingUserIndex = scoredEntries.findIndex(
      (entry) => entry.userId === input.requestingUserId,
    )

    const {
      items: pageScoredEntries,
      page,
      totalEntries,
      totalPages,
    } = paginate(scoredEntries, input.page, RANKING_PAGE_SIZE)
    const entries: RankingEntry[] = pageScoredEntries.map(
      ({ userId, username, level, xp, profitabilityPct }) => ({
        userId,
        username,
        level,
        xp,
        profitabilityPct,
      }),
    )

    return {
      window: input.criterion === 'level' ? null : (input.window ?? null),
      scope: input.scope,
      criterion: input.criterion,
      entries,
      requestingUserPosition: requestingUserIndex === -1 ? null : requestingUserIndex + 1,
      page,
      pageSize: RANKING_PAGE_SIZE,
      totalEntries,
      totalPages,
    }
  }

  // Critério "maior nível" (6.8.3) — não chama o motor nenhuma vez, não faz
  // replay, não usa `windowFor`: só lê `user_progression` por usuário do
  // escopo (`LevelReader`), muito mais barato que os outros 3 critérios
  // (que fazem até 3 chamadas ao motor por usuário). Cumulativo desde
  // sempre — sem baseline, sem janela.
  private async scoreByLevel(users: { id: string; username: string }[]): Promise<ScoredEntry[]> {
    const settledEntries = await Promise.all(
      users.map(async (user): Promise<ScoredEntry | null> => {
        try {
          const { level, xp } = await this.levelReader.getProgression(user.id)
          return {
            userId: user.id,
            username: user.username,
            level,
            xp,
            profitabilityPct: null,
            sortKey: xp,
          }
        } catch (err) {
          // Mesmo tratamento de `scoreByProfitability` — um usuário sem
          // progressão consistente (`user_progression` órfã/parcial) não
          // pode derrubar o ranking inteiro pros demais.
          console.error(
            `ranking: falha ao calcular nível do usuário ${user.id}, excluído desta resposta:`,
            err,
          )
          return null
        }
      }),
    )

    return settledEntries.filter((entry): entry is ScoredEntry => entry !== null)
  }

  private async scoreByProfitability(
    users: { id: string; username: string; createdAt: Date }[],
    criterion: 'overall' | 'fixedIncome' | 'variableIncome',
    window: WindowKind,
  ): Promise<ScoredEntry[]> {
    const { start } = windowFor(window, new Date())
    const sandboxAssetIds = await this.sandboxAssetReader.listSandboxAssetIds()
    const field = snapshotField(criterion)

    const settledEntries = await Promise.all(
      users.map(async (user): Promise<ScoredEntry | null> => {
        // "resultado consistente independente de quando o usuário entrou"
        // — quem se cadastrou no meio da janela começa a janela dele com
        // o capital inicial (RNF06), não com histórico anterior à conta.
        const baselineAsOf = start.getTime() > user.createdAt.getTime() ? start : user.createdAt

        try {
          const [baseline, current, { level, xp }] = await Promise.all([
            this.getNetWorth.execute({ userId: user.id, asOf: baselineAsOf, sandboxAssetIds }),
            this.getNetWorth.execute({ userId: user.id, sandboxAssetIds }),
            this.levelReader.getProgression(user.id),
          ])

          // Sem posição nenhuma dessa classe no início da janela — "nunca
          // investiu" não é o mesmo que "empatou em 0%" (achado da 6.8.3):
          // excluído deste critério em vez de mostrado com um 0% enganoso.
          // Não se aplica ao critério `overall` (baseline nunca é
          // legitimamente 0 — RNF06 garante R$10.000 iniciais).
          if (criterion !== 'overall' && baseline[field] === 0) {
            return null
          }

          const pct = profitabilityPct(baseline[field], current[field])
          return {
            userId: user.id,
            username: user.username,
            level,
            xp,
            profitabilityPct: pct,
            sortKey: pct,
          }
        } catch (err) {
          // Um usuário sem estado consistente no motor (ex: conta que
          // nunca terminou de ser provisionada, dado órfão de ambiente)
          // não pode derrubar o ranking inteiro pros demais — exclui só
          // esse usuário desta resposta em vez de propagar o erro pro
          // `Promise.all` externo. Achado ao validar a tarefa 6.8 (usuário
          // seedado manualmente sem conta correspondente no motor
          // causava `500` em `GET /ranking` pra qualquer um).
          console.error(
            `ranking: falha ao calcular patrimônio do usuário ${user.id}, excluído desta resposta:`,
            err,
          )
          return null
        }
      }),
    )

    return settledEntries.filter((entry): entry is ScoredEntry => entry !== null)
  }
}
