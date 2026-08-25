export type ProfileWindow = 'week' | 'month'

// Port própria e mínima sobre `modules/ranking` (5.5) — implementada, na
// composição (app.ts), por um adapter em processo sobre `NetWorthReader`/
// `SandboxAssetReader` que só devolve o percentual (nunca `total`/`cash`) —
// a blindagem de RNF09 é estrutural: o valor absoluto nem atravessa esta
// fronteira, não é um campo omitido depois.
export interface ProfitabilityReader {
  getProfitabilityPct(userId: string, window: ProfileWindow, userCreatedAt: Date): Promise<number>
}
