export interface AvatarProps {
    username: string
    // `sm` (36px, sem moldura) é o padrão em linha de lista — `FriendsList`,
    // `FriendRequestsPanel`, `UserSearchResults`. `lg` (64px, com anel) é o
    // destaque de topo de página — `PublicProfileCard`.
    size?: 'sm' | 'lg'
    // Tarefa 6.10.8 — quando presente, mostra a foto real em vez das
    // iniciais; `null`/`undefined` (usuário nunca fez upload) cai no
    // fallback de sempre.
    avatarUrl?: string | null
    // Moldura do PRO (MO.5.1): chave do catálogo; ausente ou desconhecida = sem moldura.
    frame?: string | null
}
