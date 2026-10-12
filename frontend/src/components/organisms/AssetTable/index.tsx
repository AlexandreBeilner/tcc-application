import type { KeyboardEvent } from 'react'
import { Sparkline } from '../../atoms/Sparkline'
import type { AssetSummary } from '../../../services/market'
import type { AssetTableColumn, AssetTableProps, AssetTableSlot } from './types'
import styles from './index.module.css'

export type { AssetTableColumn, AssetTableProps, AssetTableSlot } from './types'

// Listas de ativos das telas 4.2/4.4 no padrão "corretora" (MO.9.5): ticker em destaque e nome em
// linha secundária, preço à direita, variação em chip (Delta), etiqueta discreta e, onde há
// série, a mini sparkline. As colunas variam por aba, então este componente não as conhece, só
// as renderiza (`columns` vem de cada página; `slot` diz o papel no cartão). Os dois markups
// (tabela e cartões) ficam no DOM e a media query decide qual aparece, pra não depender de
// `matchMedia` em teste.
function byCardSlot(columns: AssetTableColumn[], slot: AssetTableSlot): AssetTableColumn | undefined {
    return columns.find((column) => column.slot === slot)
}

function activateOnKey(event: KeyboardEvent, onActivate: () => void) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onActivate()
    }
}

export function AssetTable({ assets, columns, onSelect, emptyMessage, sparklines }: AssetTableProps) {
    if (assets.length === 0) {
        return <p className={styles.empty}>{emptyMessage}</p>
    }

    const showSparkline = sparklines !== undefined
    const title = byCardSlot(columns, 'title')
    const subtitle = byCardSlot(columns, 'subtitle')
    const tag = byCardSlot(columns, 'tag')
    const price = byCardSlot(columns, 'price')
    const change = byCardSlot(columns, 'change')
    const extraColumns = columns.filter((column) => !column.slot)

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key} className={`${styles.th} ${column.align === 'end' ? styles.end : ''}`}>
                                {column.header}
                            </th>
                        ))}
                        {showSparkline && <th className={`${styles.th} ${styles.end}`}>Últimos 30 dias</th>}
                    </tr>
                </thead>
                <tbody>
                    {assets.map((asset: AssetSummary) => (
                        <tr
                            key={asset.id}
                            className={styles.tr}
                            tabIndex={0}
                            onClick={() => onSelect(asset)}
                            onKeyDown={(event) => {
                                if (event.target === event.currentTarget) activateOnKey(event, () => onSelect(asset))
                            }}
                        >
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    className={[
                                        styles.td,
                                        column.align === 'end' ? styles.end : '',
                                        column.slot === 'title' ? styles.titleCell : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    {column.slot === 'tag' ? (
                                        <span className={styles.tag}>{column.render(asset)}</span>
                                    ) : (
                                        column.render(asset)
                                    )}
                                </td>
                            ))}
                            {showSparkline && (
                                <td className={`${styles.td} ${styles.end}`}>
                                    <span className={styles.sparkCell}>
                                        <Sparkline values={sparklines[asset.id]} width={96} height={32} />
                                    </span>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            <ul className={styles.cards}>
                {assets.map((asset: AssetSummary) => (
                    <li key={asset.id}>
                        <button
                            type="button"
                            className={`${styles.card} ${showSparkline ? '' : styles.cardNoSpark}`}
                            onClick={() => onSelect(asset)}
                        >
                            <span className={styles.cardMain}>
                                {title && <span className={styles.cardTitle}>{title.render(asset)}</span>}
                                {subtitle && <span className={styles.cardSubtitle}>{subtitle.render(asset)}</span>}
                                {tag && <span className={styles.tag}>{tag.render(asset)}</span>}
                            </span>
                            {showSparkline && <Sparkline values={sparklines[asset.id]} className={styles.cardSpark} />}
                            <span className={styles.cardValues}>
                                {price && <span className={`${styles.cardPrice} tabular-nums`}>{price.render(asset)}</span>}
                                {change && <span className={styles.cardChange}>{change.render(asset)}</span>}
                            </span>
                            {extraColumns.length > 0 && (
                                <span className={styles.cardExtras}>
                                    {extraColumns.map((column) => (
                                        <span key={column.key} className={styles.cardRow}>
                                            <span className={styles.cardLabel}>{column.header}</span>
                                            <span className={styles.cardValue}>{column.render(asset)}</span>
                                        </span>
                                    ))}
                                </span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

// Esqueleto do tamanho final da lista (mesma altura de linha e de cartão): a página não pula quando
// os dados chegam. O texto de status fica só para leitor de tela.
export function AssetTableSkeleton({ rows = 6, label = 'Carregando ativos…' }: { rows?: number; label?: string }) {
    return (
        <div className={styles.wrapper} role="status" aria-live="polite">
            <span className={styles.srOnly}>{label}</span>
            <div className={styles.skeletonList} aria-hidden="true">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className={styles.skeletonRow} />
                ))}
            </div>
        </div>
    )
}
