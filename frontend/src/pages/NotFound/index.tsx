import { Link } from 'react-router-dom'
import styles from './index.module.css'

// Rota coringa (`*`): qualquer URL que nenhuma rota do router reconhece cai
// aqui, em vez da tela de erro padrão do React Router (que mostra texto de
// desenvolvedor). Fica fora do <AppShell> e do <ProtectedRoute> pra
// funcionar igual logado ou não.
export function NotFound() {
    return (
        <main className={styles.page}>
            <p className={styles.code}>404</p>
            <h1 className={styles.title}>Página não encontrada</h1>
            <p className={styles.text}>O endereço que você abriu não existe ou foi movido.</p>
            <Link to="/" className={styles.link}>
                Voltar para o início
            </Link>
        </main>
    )
}
