import { Select } from '../../atoms/Select'
import { formatCurrency } from '../../../features/portfolio/format'
import type { BotFundingFormProps } from './types'
import styles from './index.module.css'

export type { BotFundingFormProps } from './types'

// Aporte de caixa e/ou posição num bot (N.15), mostrado dentro do diálogo de confirmação. Só soma:
// nunca remove caixa nem posição existente. A posição é valorizada pela última cotação do ativo e
// respeita o total de cotas em circulação; como o float costuma estar todo distribuído, o caminho
// comum pra um Market Maker esgotado é o aporte de caixa.
export function BotFundingForm({ values, onChange, errors, assetOptions, currentCash }: BotFundingFormProps) {
    const set = (patch: Partial<typeof values>) => onChange({ ...values, ...patch })

    return (
        <div className={styles.form}>
            <p className={styles.current}>Caixa atual do bot: {formatCurrency(currentCash)}</p>
            {errors.form && (
                <p className={styles.formError} role="alert">
                    {errors.form}
                </p>
            )}

            <label className={styles.field}>
                <span>Caixa a aportar (R$)</span>
                <input
                    className={styles.input}
                    inputMode="decimal"
                    value={values.cash}
                    onChange={(event) => set({ cash: event.target.value })}
                    aria-invalid={errors.cash ? true : undefined}
                />
                {errors.cash && (
                    <span className={styles.fieldError} role="alert">
                        {errors.cash}
                    </span>
                )}
            </label>

            <fieldset className={styles.group}>
                <legend className={styles.legend}>Posição a aportar (opcional)</legend>
                <div className={styles.row}>
                    <label className={styles.field}>
                        <span>Ativo</span>
                        <Select
                            aria-label="Ativo da posição"
                            value={values.assetId}
                            options={assetOptions}
                            onChange={(assetId) => set({ assetId })}
                        />
                        {errors.assetId && (
                            <span className={styles.fieldError} role="alert">
                                {errors.assetId}
                            </span>
                        )}
                    </label>
                    <label className={styles.field}>
                        <span>Quantidade de cotas</span>
                        <input
                            className={styles.input}
                            inputMode="numeric"
                            value={values.quantity}
                            onChange={(event) => set({ quantity: event.target.value })}
                            aria-invalid={errors.quantity ? true : undefined}
                        />
                        {errors.quantity && (
                            <span className={styles.fieldError} role="alert">
                                {errors.quantity}
                            </span>
                        )}
                    </label>
                </div>
                <p className={styles.hint}>
                    A posição é valorizada pela última cotação e não pode passar do total de cotas em circulação do ativo. Se o float já
                    estiver todo distribuído, o aporte de posição é recusado e nada é gravado.
                </p>
            </fieldset>
        </div>
    )
}
