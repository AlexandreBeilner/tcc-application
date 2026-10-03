import { Link } from 'react-router-dom'
import { ADMIN_SECTIONS } from '../../features/admin/adminSections'
import styles from './index.module.css'

// Tela 10.1 (hub do painel admin, N.3). Provisória até a N.5 (dashboard de
// saúde e estado do mercado): por enquanto só apresenta as seções e quais já
// têm tela. Cada tarefa seguinte da Fase N liga a sua em `ADMIN_SECTIONS`.
export function AdminVisaoGeral() {
    const sections = ADMIN_SECTIONS.filter((section) => section.key !== 'overview')

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Painel Administrativo</h1>
            <p className={styles.subtitle}>Centro de controle da aplicação. As seções abaixo chegam ao longo da Fase N.</p>

            <ul className={styles.grid}>
                {sections.map(({ key, label, Icon, to }) => (
                    <li key={key}>
                        {to ? (
                            <Link to={to} className={styles.card}>
                                <Icon size={20} aria-hidden="true" />
                                <span className={styles.cardLabel}>{label}</span>
                            </Link>
                        ) : (
                            <div className={`${styles.card} ${styles.disabled}`} aria-disabled="true">
                                <Icon size={20} aria-hidden="true" />
                                <span className={styles.cardLabel}>{label}</span>
                                <span className={styles.soon}>Em breve</span>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </main>
    )
}
