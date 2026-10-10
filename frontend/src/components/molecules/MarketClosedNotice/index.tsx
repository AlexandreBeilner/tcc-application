import styles from './index.module.css'

// Aviso em texto de que o mercado está fechado, ao lado do botão desabilitado
// (tarefa S.11): o motivo nunca depende só de cor ou do estado do botão.
export function MarketClosedNotice({ reason }: { reason: string }) {
    return (
        <p className={styles.notice} role="status">
            {reason}
        </p>
    )
}
