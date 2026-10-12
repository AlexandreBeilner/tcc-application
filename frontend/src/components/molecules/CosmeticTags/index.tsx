import type { PublicCosmetics } from '../../../services/cosmetics'
import { ProSeal } from '../../atoms/ProSeal'
import { UserTitle } from '../../atoms/UserTitle'
import styles from './index.module.css'

// Linha de identidade do PRO abaixo/ao lado do nome (MO.5.1): selo e título. Não renderiza nada
// para quem não é PRO, então telas sem cosmético ficam exatamente como eram.
export function CosmeticTags({ cosmetics }: { cosmetics: PublicCosmetics }) {
    if (!cosmetics.isPro && !cosmetics.title) return null
    return (
        <span className={styles.tags}>
            {cosmetics.isPro && <ProSeal />}
            {cosmetics.title && <UserTitle title={cosmetics.title} />}
        </span>
    )
}
