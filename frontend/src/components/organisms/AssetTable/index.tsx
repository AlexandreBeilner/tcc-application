import type { AssetTableProps } from './types'
import styles from './index.module.css'

export type { AssetTableColumn, AssetTableProps } from './types'

// Listas de ativos das telas 4.2/4.4 — colunas variam por aba (ticker/
// risco/vencimento/taxa pra renda fixa; ticker/índice/preço pra ETF;
// ticker/perfil/segmento/DY pra FII — inventário 4.2/4.4), então este
// componente não conhece as colunas, só as renderiza (`columns` vem de
// cada página). Backlog 6.5: "lista densa em tabela faz sentido em
// desktop, mas em mobile a mesma informação vira lista de cards
// empilhados" — os dois markups sempre existem no DOM, a media query
// (index.module.css) decide qual aparece, pra não depender de
// `matchMedia` em teste.
export function AssetTable({ assets, columns, onSelect, emptyMessage }: AssetTableProps) {
    if (assets.length === 0) {
        return <p className={styles.empty}>{emptyMessage}</p>
    }

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key} className={styles.th}>
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {assets.map((asset) => (
                        <tr key={asset.id} className={styles.tr} onClick={() => onSelect(asset)}>
                            {columns.map((column) => (
                                <td key={column.key} className={styles.td}>
                                    {column.render(asset)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className={styles.cards}>
                {assets.map((asset) => (
                    <button key={asset.id} type="button" className={styles.card} onClick={() => onSelect(asset)}>
                        {columns.map((column) => (
                            <div key={column.key} className={styles.cardRow}>
                                <span className={styles.cardLabel}>{column.header}</span>
                                <span className={styles.cardValue}>{column.render(asset)}</span>
                            </div>
                        ))}
                    </button>
                ))}
            </div>
        </div>
    )
}
