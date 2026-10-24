// Espelha `.docs/backend/cosmetics.md`.
export type CosmeticKind = 'frame' | 'title'

// O que os outros veem ao lado do nome (moldura e título), presente em ranking, feed,
// busca/lista de amigos e perfil público. `frame` é a chave da moldura (o visual vive em
// `AvatarFrame`), `title` já é o texto. Só apresentação: nunca muda ordem nem carrega valor.
export interface PublicCosmetics {
    frame: string | null
    title: string | null
}

export interface CosmeticItem {
    key: string
    kind: CosmeticKind
    name: string
    description: string
    sortOrder: number
    // Quantos convites válidos liberam o item (MO.7.2); nulo = livre para todos.
    unlockReferrals: number | null
}

export interface CosmeticSelection {
    frame: string | null
    title: string | null
}

export interface MyCosmetics {
    // Convites válidos da pessoa: item com `unlockReferrals` maior que isto aparece bloqueado.
    referralCount: number
    catalog: CosmeticItem[]
    // O que a pessoa escolheu.
    selection: CosmeticSelection
    // Como os outros enxergam a pessoa agora.
    display: PublicCosmetics
}
