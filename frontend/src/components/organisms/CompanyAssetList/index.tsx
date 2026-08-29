import type { CompanyAssetListProps } from './types'
import styles from './index.module.css'

export type { CompanyAssetListProps } from './types'

// Ativos emitidos pela empresa (tela 4.6, ON/PN — inventário: "uma empresa
// pode emitir ON e PN", nunca ETF/FII, que não têm `company_id`).
export function CompanyAssetList({ assets, onSelect }: CompanyAssetListProps) {
    if (assets.length === 0) {
        return <p className={styles.empty}>Nenhum ativo emitido por esta empresa ainda.</p>
    }

    return (
        <ul className={styles.list}>
            {assets.map((asset) => (
                <li key={asset.id}>
                    <button type="button" className={styles.item} onClick={() => onSelect(asset)}>
                        <span className={styles.ticker}>{asset.ticker}</span>
                        <span className={styles.name}>
                            {asset.name}
                            {asset.share_class && ` · ${asset.share_class}`}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    )
}
