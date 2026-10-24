import styles from './index.module.css'

// Título escolhido pela pessoa (MO.5.1), em texto pequeno abaixo ou ao lado do nome. Descreve
// postura, nunca resultado: não é conquista.
export function UserTitle({ title }: { title: string }) {
    return <span className={styles.title}>{title}</span>
}
