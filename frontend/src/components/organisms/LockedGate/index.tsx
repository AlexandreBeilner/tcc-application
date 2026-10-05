import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import { Locked } from '../../atoms/Locked'
import type { LockedGateProps, LockedGateVariant } from './types'
import styles from './index.module.css'

export type { LockedGateProps, LockedGateVariant } from './types'

const ICON_SIZE: Record<LockedGateVariant, number> = { screen: 48, section: 32, inline: 20 }

// Card único de bloqueio pela trilha (RC.2.5, substitui `LockedAssetPanel` +
// `LockedScreen`). Em qualquer tela travada ele é a ÚNICA coisa exibida até
// a chave ser desbloqueada (Fase Q, "bloqueio é parede"). O painel antigo
// não definia largura e herdava o contêiner (encolhia numa tela, esticava
// noutra); agora cada variante fixa a própria largura máxima, ícone e
// padding. Nunca cita o código da lição, só o título. CTA vai pra
// `/trilha/:id` quando a lição é conhecida e alcançável, senão pro Mapa da
// Trilha (`/trilha`): sem `lessonId` (403 não traz `id`) ou com
// `reachable: false` (N.2, evita navegar pra lição que o backend devolveria
// 404).
export function LockedGate({ variant, lessonId, lessonTitle, reachable }: LockedGateProps) {
    const navigate = useNavigate()
    const description = lessonTitle
        ? `Complete a lição "${lessonTitle}" na trilha pra liberar isso.`
        : 'Ainda não há lição cobrindo este produto.'
    const destination = lessonId && reachable !== false ? `/trilha/${lessonId}` : '/trilha'
    const role = variant === 'screen' ? 'status' : 'note'

    return (
        <div className={`${styles.gate} ${styles[variant]}`} role={role} data-variant={variant}>
            <span className={styles.seal}>
                <Locked size={ICON_SIZE[variant]} />
            </span>
            <div className={styles.body}>
                <h2 className={styles.title}>Travado pela trilha</h2>
                <p className={styles.description}>{description}</p>
                <div className={styles.cta}>
                    <Button variant={variant === 'inline' ? 'secondary' : 'primary'} onClick={() => navigate(destination)}>
                        Ir pra lição
                    </Button>
                </div>
            </div>
        </div>
    )
}
