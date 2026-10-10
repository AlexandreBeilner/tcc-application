import type { ReactNode } from 'react'
import styles from './index.module.css'

interface AuthCardProps {
    subtitle: string
    children: ReactNode
}

// Moldura das telas públicas de recuperação de senha (EM.2.3): marca, subtítulo e um cartão
// centralizado, igual ao da tela 1.1. É um card único de propósito (como o Login): não há
// painel lateral a compor, então nos três breakpoints só muda a folga em volta.
export function AuthCard({ subtitle, children }: AuthCardProps) {
    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.brand}>Investimenta</h1>
                <p className={styles.subtitle}>{subtitle}</p>
                {children}
            </div>
        </main>
    )
}
