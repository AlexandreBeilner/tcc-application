import { authed, sleep } from './http'
import { loginAsAdmin } from './users'

export interface TickResult {
  day: number
  selic_rate: number
  quotes_count: number
  fundamentals_count: number
  is_copom_day: boolean
  is_report_day: boolean
  dividends_generated_count: number
  dividends_paid_count: number
  bot_fills_count: number
  expired_orders_count: number
  uncovered_assets_count: number
  intraday_rounds_count: number
}

// POST /admin/tick (proxy novo desta tarefa, ver .docs/backend/admin.md) —
// 409 é "já existe um tick em andamento" (trava consultiva do motor,
// tarefa S.3, pode acontecer se o job diário automático rodar no meio da
// suíte); espera um instante e tenta de novo em vez de falhar o teste por
// uma corrida que não é bug nenhum.
//
// 401 `reauth_required` (N.22): tick é ação destrutiva e exige senha conferida há menos de
// 5 minutos, mas um teste longo segura o mesmo token por mais que isso. Em vez de repassar
// o token velho, relogamos como admin (login zera o relógio e não passa pelo limite de
// `/auth/reauth`) e repetimos; o token novo vale pras chamadas seguintes do mesmo teste.
let currentAdminToken: { original: string; fresh: string } | undefined

export async function triggerTick(adminToken: string): Promise<TickResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = currentAdminToken?.original === adminToken ? currentAdminToken.fresh : adminToken
    const res = await authed(token).post('/admin/tick')
    if (res.status === 200) {
      return res.body as TickResult
    }
    if (res.status === 401 && res.body?.error === 'reauth_required') {
      currentAdminToken = { original: adminToken, fresh: await loginAsAdmin() }
      continue
    }
    if (res.status === 409) {
      await sleep(1000)
      continue
    }
    throw new Error(`falha ao executar tick: ${res.status} ${JSON.stringify(res.body)}`)
  }
  throw new Error('POST /admin/tick continuou em conflito (409) após várias tentativas')
}

// Avança dias simulados até `predicate(result)` ser verdadeiro, ou lança
// erro depois de `maxTicks` — mesmo mecanismo manual já usado em várias
// sessões de validação (ex: tarefas 4.9/4.10), formalizado aqui.
export async function tickUntil(
  adminToken: string,
  predicate: (result: TickResult) => boolean,
  maxTicks = 120,
): Promise<TickResult> {
  let last: TickResult | undefined
  for (let i = 0; i < maxTicks; i++) {
    last = await triggerTick(adminToken)
    if (predicate(last)) {
      return last
    }
  }
  throw new Error(
    `predicado não satisfeito após ${maxTicks} ticks (último resultado: ${JSON.stringify(last)})`,
  )
}
