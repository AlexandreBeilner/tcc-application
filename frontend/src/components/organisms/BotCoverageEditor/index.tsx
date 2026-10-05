import type { BotCoverageEditorProps } from './types'
import styles from './index.module.css'

export type { BotCoverageEditorProps } from './types'

// Editor da cobertura de um Market Maker (N.2), mostrado dentro do diálogo de confirmação. A
// seleção é o conjunto FINAL de ativos (o motor substitui o atual). Ativo coberto por outro
// Market Maker não aparece: mover é tirar de um e adicionar no outro.
export function BotCoverageEditor({
    options,
    selected,
    onSelectedChange,
    maxCovered,
    onMaxCoveredChange,
    maxError,
}: BotCoverageEditorProps) {
    const toggle = (assetId: string) =>
        onSelectedChange(selected.includes(assetId) ? selected.filter((id) => id !== assetId) : [...selected, assetId])

    return (
        <div className={styles.editor}>
            <label className={styles.field}>
                <span>Teto de ativos cobertos</span>
                <input
                    className={styles.input}
                    inputMode="numeric"
                    value={maxCovered}
                    onChange={(event) => onMaxCoveredChange(event.target.value)}
                    aria-invalid={maxError ? true : undefined}
                />
                {maxError && (
                    <span className={styles.fieldError} role="alert">
                        {maxError}
                    </span>
                )}
            </label>
            <fieldset className={styles.group}>
                <legend className={styles.legend}>Ativos cobertos ({selected.length} selecionados)</legend>
                {options.length === 0 ? (
                    <p className={styles.empty}>Nenhum ativo disponível: todos já são cobertos por outros Market Makers.</p>
                ) : (
                    <ul className={styles.list}>
                        {options.map((asset) => (
                            <li key={asset.asset_id}>
                                <label className={styles.check}>
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(asset.asset_id)}
                                        onChange={() => toggle(asset.asset_id)}
                                    />
                                    <span>{asset.ticker}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </fieldset>
        </div>
    )
}
