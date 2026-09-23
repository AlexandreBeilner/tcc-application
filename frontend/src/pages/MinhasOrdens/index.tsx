import { OrdersList } from '../../components/organisms/OrdersList'
import { useMyOrdersQuery } from '../../features/market/useMyOrdersQuery'
import styles from './index.module.css'

// Tela 4.10 (inventário) — tarefa O.4, fecha o achado 012 junto com O.3:
// cancelamento (O.1) fica correto no motor, mas inutilizável ponta a ponta
// sem uma tela real pra listar `order_id`/status.
export function MinhasOrdens() {
    const ordersQuery = useMyOrdersQuery()

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Minhas Ordens</h1>

            {ordersQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar suas ordens agora. Tente novamente em instantes.
                </p>
            )}

            {!ordersQuery.data && !ordersQuery.isError && <p className={styles.loading}>Carregando ordens…</p>}

            {ordersQuery.data && <OrdersList orders={ordersQuery.data.orders} />}
        </main>
    )
}
