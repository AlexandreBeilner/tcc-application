import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRemoveFriendshipMutation } from '../../../features/friendships/useRemoveFriendshipMutation'
import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import { Pagination } from '../../molecules/Pagination'
import type { FriendsListProps } from './types'
import styles from './index.module.css'
import { CosmeticTags } from '../../molecules/CosmeticTags'

export type { FriendsListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Tela 8.1 (hub) — estado vazio (inventário: "sem amigos ainda, CTA pra
// buscar") vai direto pra 8.2 (`/amigos/buscar`), não pro próprio hub.
// Clique num amigo → 8.4 (`/perfil/:id`). Sem rentabilidade por card:
// `GET /friendships` (`.docs/backend/friendships.md`) não devolve esse
// dado — quem quiser comparar rentabilidade entra no perfil (8.4) ou usa a
// Classificação com escopo Amigos (7.1), que já é a fonte real desse
// número (RF19). Paginação (6.9.1) reaproveita `Pagination`, mesmo padrão
// de `RankingBoard`. "Desfazer amizade" (6.9.3) fica fora do
// `.profileLink` — dois elementos interativos irmãos na `<li>`, não um
// botão aninhado dentro do outro; confirmação leve em duas etapas
// (clicar de novo confirma), sem `window.confirm` nativo (sem precedente
// no app, quebraria o visual próprio das telas).
export function FriendsList({ friends, page, totalPages, onPageChange }: FriendsListProps) {
    const navigate = useNavigate()
    const removeFriendship = useRemoveFriendshipMutation()
    const [confirmingId, setConfirmingId] = useState<string | null>(null)

    if (friends.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p className={styles.emptyBody}>Você ainda não tem amigos por aqui. Busque por username pra adicionar o primeiro.</p>
                <Button variant="secondary" onClick={() => navigate('/amigos/buscar')}>
                    Buscar amigos
                </Button>
            </div>
        )
    }

    return (
        <>
            <ul className={styles.list}>
                {friends.map((friend) => {
                    const isConfirming = confirmingId === friend.friendshipId
                    const isRemoving = removeFriendship.isPending && removeFriendship.variables === friend.friendshipId

                    return (
                        <li key={friend.userId} className={styles.row}>
                            <button type="button" className={styles.profileLink} onClick={() => navigate(`/perfil/${friend.userId}`)}>
                                <Avatar username={friend.username} avatarUrl={friend.avatarUrl} frame={friend.cosmetics.frame} />
                                <span className={styles.info}>
                                    <span className={styles.name}>{friend.name}</span>
                                    <span className={styles.username}>@{friend.username}</span>
                                    <CosmeticTags cosmetics={friend.cosmetics} />
                                </span>
                                <span className={styles.since}>Amigos desde {dateFormatter.format(new Date(friend.friendsSince))}</span>
                            </button>

                            {isConfirming ? (
                                <div className={styles.confirmActions}>
                                    <Button variant="secondary" disabled={isRemoving} onClick={() => setConfirmingId(null)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        disabled={isRemoving}
                                        onClick={() => {
                                            removeFriendship.mutate(friend.friendshipId)
                                            setConfirmingId(null)
                                        }}
                                    >
                                        Confirmar
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="secondary" onClick={() => setConfirmingId(friend.friendshipId)}>
                                    Desfazer amizade
                                </Button>
                            )}
                        </li>
                    )
                })}
            </ul>

            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} ariaLabel="Paginação de amigos" />
        </>
    )
}
