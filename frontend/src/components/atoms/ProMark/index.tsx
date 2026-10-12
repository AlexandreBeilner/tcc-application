import styles from './index.module.css'

// Marca dourada "PRO" que fica no canto da logo do cabeçalho de quem assina (MO.9.8, decisão do
// autor em 2026-10-12). Dourado aqui é exceção deliberada à regra "dourado = conquista" dos tokens
// (seção 2.4): o selo azul `ProSeal` continua sendo o do perfil e dos rankings.
export function ProMark() {
    return (
        <span className={styles.mark} title="Assinante PRO" role="img" aria-label="Assinante PRO">
            PRO
        </span>
    )
}
