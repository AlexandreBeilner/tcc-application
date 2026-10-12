import { Link } from 'react-router-dom'
import { useBillingStatusQuery } from '../../../features/billing/useBillingStatus'
import styles from './index.module.css'
import type { AssemblyProBlockProps } from './types'

// Bloco informativo "Como o PRO participa" (MO.9.7). As regras espelham `modules/assemblies`: o
// PRO vota sem gastar o voto do mês e propõe pautas do catálogo, sempre só em empresa que possui;
// quem não é PRO tem 1 voto por mês (nível 3, e-mail verificado); o resultado vale para todos.
// Só informa: nada aqui bloqueia o voto, e o link ao PRO é um convite, sem urgência.
export function AssemblyProBlock({ hideLink = false }: AssemblyProBlockProps) {
    const billing = useBillingStatusQuery().data
    if (!billing) return null

    return (
        <section className={styles.block} aria-labelledby="assembly-pro-title">
            <h2 id="assembly-pro-title" className={styles.title}>
                Como o PRO participa
            </h2>
            <ul className={styles.rules}>
                <li>
                    Quem é PRO vota em toda assembleia de uma empresa da qual tem ações, sem gastar o voto do mês, e propõe pautas do
                    catálogo para as próximas votações.
                </li>
                <li>Quem não é PRO tem 1 voto por mês, a partir do nível 3 e com e-mail verificado.</li>
                <li>O resultado vale para todos os acionistas, tenham votado ou não.</li>
            </ul>
            {billing.isPro ? (
                <p className={styles.status}>Você vota em todas as assembleias das empresas que possui.</p>
            ) : (
                billing.billingEnabled &&
                !hideLink && (
                    <Link className={styles.link} to="/planos" state={{ proSource: 'assembly' }}>
                        Ver o que o PRO inclui
                    </Link>
                )
            )}
        </section>
    )
}
