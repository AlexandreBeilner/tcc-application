// O que os outros usuários veem ao lado do nome de alguém (MO.5.1): moldura do avatar e título. Só apresentação: nunca muda a ordem de um ranking nem carrega valor financeiro (RNF09).
// `frame` é a chave da moldura (o visual vive no frontend); `title` já é o texto.
export interface PublicCosmetics {
  frame: string | null
  title: string | null
}

export const NO_COSMETICS: PublicCosmetics = { frame: null, title: null }

// Porta que cada módulo consumidor declara pra si e implementa em `infrastructure/cosmetics/`.
export interface CosmeticsReader {
  findDisplays(userIds: string[]): Promise<Map<string, PublicCosmetics>>
}

// Adapter em processo sobre o caso de uso do módulo `cosmetics` (mesmo padrão dos `inProcess*`).
export function createInProcessCosmeticsReader(source: {
  execute(userIds: string[]): Promise<Map<string, PublicCosmetics>>
}): CosmeticsReader {
  return { findDisplays: (userIds) => source.execute(userIds) }
}
