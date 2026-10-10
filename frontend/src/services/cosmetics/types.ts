// Espelha `.docs/backend/cosmetics.md`.
export type CosmeticKind = 'frame' | 'title'

// O que os outros veem ao lado do nome (selo PRO, moldura e título), presente em ranking, feed,
// busca/lista de amigos e perfil público. `frame` é a chave da moldura (o visual vive em
// `AvatarFrame`), `title` já é o texto. Só apresentação: nunca muda ordem nem carrega valor.
export interface PublicCosmetics {
    isPro: boolean
    frame: string | null
    title: string | null
}

export interface CosmeticItem {
    key: string
    kind: CosmeticKind
    name: string
    description: string
    sortOrder: number
}

export interface CosmeticSelection {
    frame: string | null
    title: string | null
}

export interface MyCosmetics {
    isPro: boolean
    catalog: CosmeticItem[]
    // Escolha guardada, mesmo de quem cancelou o PRO (arquivada).
    selection: CosmeticSelection
    // Como os outros enxergam a pessoa agora.
    display: PublicCosmetics
}
