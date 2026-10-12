import type { CompanyAssetListProps } from './types'
import styles from './index.module.css'

export type { CompanyAssetListProps } from './types'

// Ativos emitidos pela empresa (tela 4.6, ON/PN — inventário: "uma empresa
// pode emitir ON e PN", nunca ETF/FII, que não têm `company_id`). Mesma
// linguagem das listas do Mercado (MO.9.5): ticker em destaque, nome em linha
// secundária, classe (ON/PN) em etiqueta, linha inteira clicável.
export function CompanyAssetList({ assets, onSelect }: CompanyAssetListProps) {
    if (assets.length === 0) {
        return <p className={styles.empty}>Nenhum ativo emitido por esta empresa ainda.</p>
    }

    return (
        <ul className={styles.list}>
            {assets.map((asset) => (
                <li key={asset.id}>
                    <button type="button" className={styles.item} onClick={() => onSelect(asset)}>
                        <span className={styles.main}>
                            <span className={styles.ticker}>{asset.ticker}</span>
                            <span className={styles.name}>{asset.name}</span>
                        </span>
                        {asset.share_class && <span className={styles.tag}>{asset.share_class}</span>}
                        <span className={styles.chevron} aria-hidden="true">
                            ›
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    )
}
