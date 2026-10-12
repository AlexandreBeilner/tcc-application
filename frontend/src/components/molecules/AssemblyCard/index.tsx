import { Link } from 'react-router-dom'
import { closesLabel, formatShortDate, outcomeBadge } from '../../../features/assemblies/assemblyText'
import type { AssemblySummary } from '../../../services/assemblies'
import styles from './index.module.css'

// Item da lista de assembleias: de que empresa é, qual a pauta e em que pé está. O estado vai
// sempre em texto (cor nunca é o único sinal).
export function AssemblyCard({ assembly, now }: { assembly: AssemblySummary; now?: Date }) {
    const open = assembly.status === 'open'
    return (
        <Link to={`/assembleias/${assembly.id}`} className={styles.card}>
            <span className={styles.company}>{assembly.subjectLabel ?? 'Empresa'}</span>
            <span className={styles.title}>{assembly.title ?? 'Assembleia de acionistas'}</span>
            <span className={styles.meta}>
                <span className={open ? styles.badgeOpen : styles.badge}>{outcomeBadge(assembly)}</span>
                <span className={styles.when}>
                    {open ? closesLabel(assembly.closesAt, now) : `Encerrada em ${formatShortDate(assembly.closesAt)}`}
                </span>
            </span>
        </Link>
    )
}
