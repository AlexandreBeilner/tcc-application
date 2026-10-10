// O que o e-mail de amizade mostra de um usuário (EM.6.2): nível e rentabilidade percentual da
// semana, nunca valor absoluto de patrimônio (RNF09: o valor nem atravessa esta fronteira).
export interface FriendProfileStats {
  level: number
  profitabilityPct: number
}

export interface FriendProfileReader {
  // `null` quando não dá para ler agora (ex.: motor fora do ar): o e-mail sai sem as estatísticas
  // em vez de deixar de sair.
  read(userId: string): Promise<FriendProfileStats | null>
}
