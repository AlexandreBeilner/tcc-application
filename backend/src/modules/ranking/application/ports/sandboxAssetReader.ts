// Ids de ativo com `is_sandbox = true` (4.6/4.11) — resolvido uma vez por
// cálculo de ranking (GetRankingUseCase) e repassado a cada
// `GetNetWorthUseCase.execute`, evitando refazer a mesma chamada `GET
// /assets` uma vez por usuário.
export interface SandboxAssetReader {
  listSandboxAssetIds(): Promise<Set<string>>
}
