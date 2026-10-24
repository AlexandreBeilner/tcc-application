import type { PublicCosmetics } from '../../../services/cosmetics'
import { UserTitle } from '../../atoms/UserTitle'
import styles from './index.module.css'

// Linha de identidade abaixo/ao lado do nome (MO.5.1): o título escolhido. Não renderiza nada
// para quem não escolheu título, então telas sem cosmético ficam exatamente como eram.
export function CosmeticTags({ cosmetics }: { cosmetics: PublicCosmetics }) {
    if (!cosmetics.title) return null
    return (
        <span className={styles.tags}>
            <UserTitle title={cosmetics.title} />
        </span>
    )
}
