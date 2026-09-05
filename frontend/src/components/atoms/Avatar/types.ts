export interface AvatarProps {
    username: string
    // `sm` (36px, sem moldura) é o padrão em linha de lista — `FriendsList`,
    // `FriendRequestsPanel`, `UserSearchResults`. `lg` (64px, com anel) é o
    // destaque de topo de página — `PublicProfileCard`.
    size?: 'sm' | 'lg'
}
