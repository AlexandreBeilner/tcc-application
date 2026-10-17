import { DAILY_CATEGORY_OPTIONS, DAILY_LEARN_MORE_OPTIONS, DAILY_SCOPE_OPTIONS } from '../../../features/admin/dailyAdmin'
import type { DailyScope } from '../../../services/admin'
import { AdminField, adminInputClass } from '../AdminField'
import type { ItemCommon } from '../../../features/admin/dailyAdmin'
import type { AdminDailyItemFieldsProps } from './types'
import styles from './index.module.css'

export type { AdminDailyItemFieldsProps } from './types'

// Categoria, marcador Brasil/fora e ligação opcional para "saiba mais" (seção 3.3 do backlog). A
// categoria e o marcador alimentam a regra de variedade da agenda.
export function AdminDailyItemFields({ value, onChange, disabled = false }: AdminDailyItemFieldsProps) {
    const set = <K extends keyof ItemCommon>(key: K, next: ItemCommon[K]) => onChange({ ...value, [key]: next })
    return (
        <>
            <div className={styles.row}>
                <AdminField label="Categoria">
                    {(id) => (
                        <select
                            id={id}
                            className={adminInputClass}
                            value={value.category}
                            disabled={disabled}
                            onChange={(e) => set('category', e.target.value)}
                        >
                            {DAILY_CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    )}
                </AdminField>
                <AdminField label="Marcador" hint="A maioria do conteúdo de cada semana deve ser sobre o Brasil.">
                    {(id) => (
                        <select
                            id={id}
                            className={adminInputClass}
                            value={value.scope}
                            disabled={disabled}
                            onChange={(e) => set('scope', e.target.value as DailyScope)}
                        >
                            {DAILY_SCOPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    )}
                </AdminField>
            </div>
            <div className={styles.row}>
                <AdminField label="Saiba mais">
                    {(id) => (
                        <select
                            id={id}
                            className={adminInputClass}
                            value={value.learnKind}
                            disabled={disabled}
                            onChange={(e) => set('learnKind', e.target.value as ItemCommon['learnKind'])}
                        >
                            {DAILY_LEARN_MORE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    )}
                </AdminField>
                {value.learnKind !== '' && (
                    <AdminField label="Referência" hint="Termo do glossário, código da lição ou nome do guia.">
                        {(id) => (
                            <input
                                id={id}
                                className={adminInputClass}
                                value={value.learnRef}
                                maxLength={120}
                                disabled={disabled}
                                onChange={(e) => set('learnRef', e.target.value)}
                            />
                        )}
                    </AdminField>
                )}
            </div>
        </>
    )
}
