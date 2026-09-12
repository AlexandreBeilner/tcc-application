import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import { Locked } from '../../atoms/Locked'
import type { LockedAssetPanelProps } from './types'
import styles from './index.module.css'

export type { LockedAssetPanelProps } from './types'

// Banner "prévia, não parede" (tarefa J.3) — substitui o painel de compra
// em `AssetDetail` quando `useLockedAssetGate.isLocked` é verdadeiro, e
// também aparece em `OrderConfirmationDialog` quando a trava só é
// descoberta na confirmação (`ProductLockedError`, acesso direto por URL).
// CTA linka pro Mapa da Trilha (`/trilha`) quando não há `lessonId` (o 403
// não traz `id`, só `code`/`title` — `.docs/backend/market.md`) e pra
// `/trilha/:id` direto quando o Detalhe já resolveu a lição via
// `unlockingLessonFor`.
export function LockedAssetPanel({ lessonId, lessonCode }: LockedAssetPanelProps) {
    const navigate = useNavigate()
    const description = lessonCode ? `Desbloqueia na lição ${lessonCode}.` : 'Ainda não há lição cobrindo este produto.'

    return (
        <div className={styles.panel} role="note">
            <Locked size={20} />
            <span className={styles.title}>Travado pela trilha</span>
            <p className={styles.description}>{description}</p>
            <Button onClick={() => navigate(lessonId ? `/trilha/${lessonId}` : '/trilha')}>Ir pra lição</Button>
        </div>
    )
}
