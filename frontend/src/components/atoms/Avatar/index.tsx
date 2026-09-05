import type { AvatarProps } from './types'
import styles from './index.module.css'

export type { AvatarProps } from './types'

function initials(username: string): string {
    return username.charAt(0).toUpperCase()
}

// Unifica o círculo de iniciais reimplementado em `FriendsList`,
// `FriendRequestsPanel`, `PublicProfileCard` e `UserSearchResults` (achado
// de revisão da 6.9.5/6.9.10) — mesma função `initials` e CSS quase
// idêntico nos quatro. `size="lg"` só o círculo (100% do wrapper que o
// chamador dimensionar) — o anel de XP com conic-gradient continua sendo
// responsabilidade de `PublicProfileCard`, que varia por usuário.
// `avatarUrl` (tarefa 6.10.8) troca as iniciais por uma foto real quando
// presente — fallback pras iniciais é sempre as mesmas iniciais de sempre,
// nunca um ícone genérico.
export function Avatar({ username, size = 'sm', avatarUrl }: AvatarProps) {
    if (avatarUrl) {
        return (
            <span className={`${styles.avatar} ${size === 'lg' ? styles.lg : styles.sm}`}>
                <img className={styles.image} src={avatarUrl} alt={`Foto de perfil de ${username}`} />
            </span>
        )
    }

    return (
        <span className={`${styles.avatar} ${size === 'lg' ? styles.lg : styles.sm}`} aria-hidden="true">
            {initials(username)}
        </span>
    )
}
