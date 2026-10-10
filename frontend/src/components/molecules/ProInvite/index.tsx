import { Link } from 'react-router-dom'
import { dismissProInvite, isProInviteDismissed } from '../../../features/billing/proInviteDismissal'
import { useBillingStatusQuery } from '../../../features/billing/useBillingStatus'
import { useState } from 'react'
import styles from './index.module.css'
import type { ProInviteProps } from './types'

// Convite contextual ao PRO (MO.5.5). Some para quem já é PRO, com a cobrança desligada ou
// dispensado nos últimos 30 dias. Nunca bloqueia nada: a ação do core loop fica fora dele. `/planos`
// é uma rota interna; dentro do app ela compra pela loja (MO.4.2), nunca por pagamento web.
export function ProInvite({ context, title, children }: ProInviteProps) {
    const billing = useBillingStatusQuery().data
    const [dismissed, setDismissed] = useState(() => isProInviteDismissed(context))

    if (!billing || billing.isPro || !billing.billingEnabled || dismissed) return null

    function handleDismiss() {
        dismissProInvite(context)
        setDismissed(true)
    }

    return (
        <div className={styles.invite}>
            {title && <h2 className={styles.title}>{title}</h2>}
            <p className={styles.text}>{children}</p>
            <div className={styles.actions}>
                <Link className={styles.link} to="/planos">
                    Conhecer o PRO
                </Link>
                <button type="button" className={styles.dismiss} onClick={handleDismiss}>
                    Agora não
                </button>
            </div>
        </div>
    )
}
