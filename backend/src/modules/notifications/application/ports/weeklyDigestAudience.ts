// Quem recebe o resumo semanal (EM.7.1) e o que o e-mail diz de cada um. RNF09: só nível,
// rentabilidade percentual da semana e missões; nunca patrimônio, nem o de ninguém.
export interface DigestCandidate {
  userId: string
  address: string
  name: string
  level: number
  // Rentabilidade da semana no último ranking calculado; `null` se a pessoa não está nele.
  weeklyReturnPct: number | null
  // Missões do dia ainda não concluídas.
  pendingMissions: number
  // Título de uma delas (a de maior recompensa), pra o e-mail dar um exemplo concreto.
  pendingMissionTitle: string | null
}

export interface WeeklyDigestAudience {
  // Só conta ativa, com e-mail verificado e a categoria de engajamento ligada, em páginas por
  // `userId` (cursor), pra a lista inteira nunca ficar na memória.
  listPage(afterUserId: string | null, limit: number): Promise<DigestCandidate[]>
}
