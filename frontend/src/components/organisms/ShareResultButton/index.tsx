import { useQueryClient } from '@tanstack/react-query'
import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../../features/auth/AuthContext'
import { buildInviteLink } from '../../../features/referral/referralCode'
import { MY_REFERRAL_QUERY_KEY } from '../../../features/referral/useMyReferral'
import { renderResultBlob, shareResult, withInviteLink } from '../../../features/lessons/shareResult'
import type { ShareResultOutcome } from '../../../features/lessons/shareResult'
import { getMyReferral } from '../../../services/referral'
import { Button } from '../../atoms/Button'
import type { ShareResultButtonProps } from './types'
import styles from './index.module.css'

export type { ShareResultButtonProps } from './types'

const OUTCOME_TEXT: Partial<Record<ShareResultOutcome, string>> = {
    copied: 'Texto copiado. É só colar onde quiser.',
    failed: 'Não deu para compartilhar agora.',
}

// Compartilhar o resultado de uma lição ou de uma estimativa (LJ.5.10): o menu do sistema com a imagem quando o
// aparelho aceita, e o texto copiado quando não. O link de convite é buscado só ao tocar (a tela final não faz
// uma requisição à toa) e, se falhar, o texto segue com o endereço do app. Só estudo: nunca patrimônio (RNF09).
export function ShareResultButton({ message, card }: ShareResultButtonProps) {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    const [busy, setBusy] = useState(false)
    const [outcome, setOutcome] = useState<ShareResultOutcome | null>(null)

    async function handleShare() {
        setBusy(true)
        setOutcome(null)
        let link = window.location.origin
        try {
            const referral = await queryClient.fetchQuery({
                queryKey: MY_REFERRAL_QUERY_KEY,
                queryFn: () => getMyReferral(token as string),
                staleTime: 60_000,
            })
            link = buildInviteLink(window.location.origin, referral.code)
        } catch {
            // sem o código a mensagem sai com o endereço do app
        }
        // A imagem só é montada onde o aparelho sabe compartilhar arquivo; no desktop basta copiar o texto.
        const blob = typeof navigator.canShare === 'function' ? await renderResultBlob(card) : null
        setOutcome(await shareResult(withInviteLink(message, link), blob))
        setBusy(false)
    }

    return (
        <div className={styles.share}>
            <Button variant="secondary" onClick={handleShare} disabled={busy}>
                <Share2 size={16} aria-hidden="true" />
                Compartilhar
            </Button>
            <p aria-live="polite" className={styles.status}>
                {outcome ? (OUTCOME_TEXT[outcome] ?? '') : ''}
            </p>
        </div>
    )
}
