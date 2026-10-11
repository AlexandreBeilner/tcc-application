import { Link } from 'react-router-dom'
import { useAssembliesQuery } from '../../../features/assemblies/useAssemblies'
import { AssemblyCard } from '../../molecules/AssemblyCard'
import { DividendOnHoldNotice } from '../../molecules/DividendOnHoldNotice'
import { ProposalsPanel } from '../ProposalsPanel'
import styles from './index.module.css'

const HISTORY_LIMIT = 3

// Assembleias de uma empresa na página dela: as abertas, as últimas encerradas e as propostas de
// pauta. Some inteira com o recurso desligado no servidor (a consulta responde 404).
export function CompanyAssemblies({ companyId }: { companyId: string }) {
    const query = useAssembliesQuery({ companyId, limit: HISTORY_LIMIT })
    if (!query.data) return null
    const { open, closed } = query.data

    return (
        <section className={styles.section} aria-labelledby="company-assemblies-title">
            <header className={styles.header}>
                <h2 id="company-assemblies-title" className={styles.title}>
                    Assembleias de acionistas
                </h2>
                <Link to="/assembleias" className={styles.link}>
                    Ver todas
                </Link>
            </header>
            <p className={styles.lead}>
                Depois de cada balanço, quem tinha ações da empresa decide uma pauta. Todo acionista é afetado igual, tenha votado ou não.
            </p>

            <DividendOnHoldNotice companyId={companyId} />

            {open.length === 0 && closed.length === 0 && (
                <p className={styles.muted}>Nenhuma assembleia por enquanto. Uma nova abre depois do próximo balanço da empresa.</p>
            )}
            {open.length > 0 && (
                <ul className={styles.list} aria-label="Assembleias abertas">
                    {open.map((assembly) => (
                        <li key={assembly.id}>
                            <AssemblyCard assembly={assembly} />
                        </li>
                    ))}
                </ul>
            )}
            {closed.length > 0 && (
                <>
                    <h3 className={styles.subtitle}>Últimas encerradas</h3>
                    <ul className={styles.list}>
                        {closed.map((assembly) => (
                            <li key={assembly.id}>
                                <AssemblyCard assembly={assembly} />
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <ProposalsPanel companyId={companyId} />
        </section>
    )
}
