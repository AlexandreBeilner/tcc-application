// Abre a conta de um usuário novo no motor de simulação, com o capital
// inicial padronizado (RNF06) — accounts vive no banco "market", dono é o
// motor, nunca escrito direto por aqui.
export interface AccountProvisioner {
  provision(userId: string): Promise<void>
}
