import { Link } from 'react-router-dom'
import { describePlan } from '../../../features/billing/describePlan'
import { isNativeApp, nativePlatform } from '../../../features/billing/isNativeApp'
import { useWebPurchases } from '../../../features/billing/useWebPurchases'
import { useBillingStatusQuery } from '../../../features/billing/useBillingStatus'
import styles from './index.module.css'

// Bloco "Seu plano" de Configurações (MO.3.3). Some se a cobrança está desligada e a pessoa nunca
// assinou; o destino de gerenciar depende de onde ela assinou (portal da web, App Store, Google Play).
export function PlanSection() {
    const query = useBillingStatusQuery()
    const status = query.data
    const purchases = useWebPurchases()

    if (!status || (!status.billingEnabled && status.state === 'none')) return null

    const plan = describePlan(status, isNativeApp(), nativePlatform())

    return (
        <section className={styles.section} aria-labelledby="plan-section-title">
            <h2 id="plan-section-title" className={styles.title}>
                Seu plano
            </h2>
            <p className={styles.headline}>{plan.headline}</p>
            <p className={styles.note}>{plan.detail}</p>
            {plan.instruction && <p className={styles.note}>{plan.instruction}</p>}
            {plan.action &&
                (plan.action.external && isNativeApp() && purchases?.manage ? (
                    // Dentro do app o link de loja abre pelo sistema (a ponte valida que é página de loja).
                    <button type="button" className={styles.action} onClick={() => void purchases.manage?.(plan.action?.href ?? null)}>
                        {plan.action.label}
                    </button>
                ) : plan.action.external ? (
                    <a className={styles.action} href={plan.action.href} target="_blank" rel="noopener noreferrer">
                        {plan.action.label}
                    </a>
                ) : (
                    <Link className={styles.action} to={plan.action.href}>
                        {plan.action.label}
                    </Link>
                ))}
        </section>
    )
}
