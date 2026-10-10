import styles from './index.module.css'

// Selo PRO ao lado do nome (MO.5.1). Só aparece para quem é PRO agora; quem cancelou perde o selo
// para os outros e ganha de volta ao reativar. Visual de marca (azul), nunca dourado: dourado é
// conquista real de aprendizado (tokens doc, seção 2.4).
export function ProSeal() {
    return (
        <span className={styles.seal} title="Assinante PRO" aria-label="Assinante PRO">
            PRO
        </span>
    )
}
