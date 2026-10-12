import { Link } from 'react-router-dom'
import { useProEntry } from '../../../features/billing/useProEntry'
import styles from './index.module.css'

// Link discreto "Conhecer o PRO" no cabeçalho para quem não assina (MO.9.8). Só de tablet em
// diante: no mobile a barra não comporta e o caminho é o item "Plano PRO" do menu do avatar.
// Assinante não vê nada aqui: o selo dele fica na logo. É uma entrada de navegação, não um
// convite: não conta `invite_viewed`, só marca a origem `header` quando a pessoa abre os planos.
export function ProHeaderLink() {
    if (useProEntry() !== 'visitor') return null

    return (
        <Link className={styles.link} to="/planos" state={{ proSource: 'header' }}>
            Conhecer o PRO
        </Link>
    )
}
