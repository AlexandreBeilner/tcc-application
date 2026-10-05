import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import { Locked } from '../../atoms/Locked'
import type { LockedAssetPanelProps } from './types'
import styles from './index.module.css'

export type { LockedAssetPanelProps } from './types'

// Card informativo de bloqueio (Fase Q, reversão definitiva da Fase J
// "prévia, não parede") — em qualquer tela travada pela trilha (Detalhe de
// Ativo/Produto de Renda Fixa, `LockedScreen` de rota inteira,
// `OrderConfirmationDialog` quando a trava só é descoberta na confirmação)
// este card é a ÚNICA coisa exibida enquanto a chave não for desbloqueada —
// nunca um complemento a um conteúdo real parcialmente visível. Nunca cita
// o código da lição (`lessonTitle`, não `lessonCode`): instrução direta do
// autor (2026-09-12) depois de repetidas idas e vindas sobre esse ponto —
// "Lição X.X" não pode aparecer em texto de UI fora do próprio Mapa da
// Trilha. CTA linka pro Mapa da Trilha (`/trilha`) quando não há `lessonId`
// (o 403 não traz `id`, só `code`/`title` — `.docs/backend/market.md`),
// quando a lição encontrada ainda não é alcançável pro usuário
// (`reachable: false`, tarefa N.2 — evita um CTA que navegaria pra uma
// lição que o backend devolveria 404, `LessonLockedError`), e pra
// `/trilha/:id` direto nos demais casos.
export function LockedAssetPanel({ lessonId, lessonTitle, reachable }: LockedAssetPanelProps) {
    const navigate = useNavigate()
    const description = lessonTitle
        ? `Complete a lição "${lessonTitle}" na trilha pra liberar isso.`
        : 'Ainda não há lição cobrindo este produto.'
    const destination = lessonId && reachable !== false ? `/trilha/${lessonId}` : '/trilha'

    return (
        <div className={styles.panel} role="note">
            <Locked size={20} />
            <span className={styles.title}>Travado pela trilha</span>
            <p className={styles.description}>{description}</p>
            <Button onClick={() => navigate(destination)}>Ir pra lição</Button>
        </div>
    )
}
