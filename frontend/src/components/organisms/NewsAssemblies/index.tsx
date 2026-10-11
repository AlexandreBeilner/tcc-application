import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { markAssembliesSeen } from '../../../features/assemblies/unreadAssemblies'
import { useAssembliesQuery } from '../../../features/assemblies/useAssemblies'
import { AssemblyCard } from '../../molecules/AssemblyCard'
import styles from './index.module.css'

const RECENT_CLOSED = 2

// Assembleias em Notícias: o aviso de que há votação aberta (ou resultado novo) com o atalho para
// a assembleia. Some com o recurso desligado. Abrir esta seção apaga o ponto do sino.
export function NewsAssemblies() {
    const query = useAssembliesQuery({ limit: RECENT_CLOSED })
    const open = query.data?.open
    const openIds = open?.map((a) => a.id).join(',') ?? ''

    useEffect(() => {
        if (openIds) markAssembliesSeen(openIds.split(','))
    }, [openIds])

    if (!query.data) return null
    const { closed } = query.data
    if ((open?.length ?? 0) === 0 && closed.length === 0) return null

    return (
        <section className={styles.section} aria-labelledby="news-assemblies-title">
            <header className={styles.header}>
                <h2 id="news-assemblies-title" className={styles.title}>
                    Assembleias de acionistas
                </h2>
                <Link to="/assembleias" className={styles.link}>
                    Ver todas
                </Link>
            </header>
            <ul className={styles.list}>
                {[...(open ?? []), ...closed].map((assembly) => (
                    <li key={assembly.id}>
                        <AssemblyCard assembly={assembly} />
                    </li>
                ))}
            </ul>
        </section>
    )
}
