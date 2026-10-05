import { MAX_SPREAD_PCT, WITHIN_SCOPE_RANGE } from '../../../features/admin/botForm'
import { ASSET_CLASS_LABELS, BOT_ASSET_CLASSES, BOT_RISK_CLASSES, BOT_SECTORS } from '../../../features/admin/botLabels'
import type { BotEditValues } from '../../../features/admin/botEdit'
import type { BotEditFormProps } from './types'
import styles from './index.module.css'

export type { BotEditFormProps } from './types'

function toggle(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

// Edição da personalidade de um bot (N.15), mostrada dentro do diálogo de confirmação. Controlado:
// quem decide validar e enviar é a página. Percentuais em porcentagem, como na criação. A
// preferência por ordem a mercado não aparece de propósito: é reservada e não muda o comportamento
// do bot (achado 001). Arquétipo e caixa também não mudam por aqui.
export function BotEditForm({ archetype, values, onChange, errors }: BotEditFormProps) {
    const set = <K extends keyof BotEditValues>(key: K, value: BotEditValues[K]) => onChange({ ...values, [key]: value })

    const textField = (
        key: 'withinScopePct' | 'knowledgeLevelPct' | 'maxPositionSizePct' | 'spreadWidthPct',
        label: string,
        hint: string,
    ) => (
        <label className={styles.field}>
            <span>{label}</span>
            <input
                className={styles.input}
                inputMode="decimal"
                value={values[key]}
                onChange={(event) => set(key, event.target.value)}
                aria-invalid={errors[key] ? true : undefined}
            />
            {!errors[key] && <span className={styles.hint}>{hint}</span>}
            {errors[key] && (
                <span className={styles.fieldError} role="alert">
                    {errors[key]}
                </span>
            )}
        </label>
    )

    const checkGroup = (
        legend: string,
        options: ReadonlyArray<{ value: string; label: string }>,
        selected: string[],
        key: 'sectors' | 'riskClasses' | 'assetClasses',
    ) => (
        <fieldset className={styles.group}>
            <legend className={styles.legend}>{legend}</legend>
            <div className={styles.checks}>
                {options.map((option) => (
                    <label key={option.value} className={styles.check}>
                        <input
                            type="checkbox"
                            checked={selected.includes(option.value)}
                            onChange={() => set(key, toggle(selected, option.value))}
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    )

    return (
        <div className={styles.form}>
            <div className={styles.scope}>
                <p className={styles.scopeTitle}>Escopo de especialização</p>
                {checkGroup(
                    'Setores',
                    BOT_SECTORS.map((value) => ({ value, label: value })),
                    values.sectors,
                    'sectors',
                )}
                {checkGroup(
                    'Classes de risco',
                    BOT_RISK_CLASSES.map((value) => ({ value, label: value })),
                    values.riskClasses,
                    'riskClasses',
                )}
                {checkGroup(
                    'Classes de ativo',
                    BOT_ASSET_CLASSES.map((value) => ({ value, label: ASSET_CLASS_LABELS[value] })),
                    values.assetClasses,
                    'assetClasses',
                )}
                {errors.sectors && (
                    <span className={styles.fieldError} role="alert">
                        {errors.sectors}
                    </span>
                )}
            </div>

            <div className={styles.numbers}>
                {textField(
                    'withinScopePct',
                    'Atividade dentro do escopo (%)',
                    `De ${WITHIN_SCOPE_RANGE.min} a ${WITHIN_SCOPE_RANGE.max}. O resto vai pra fora do escopo.`,
                )}
                {archetype === 'fundamentalista' && textField('knowledgeLevelPct', 'Nível de conhecimento (%)', 'De 0 a 100.')}
                {textField('maxPositionSizePct', 'Tamanho máximo de posição por ordem (%)', 'Fração do caixa ou da posição numa ordem.')}
                {textField('spreadWidthPct', 'Largura do spread (%)', `De 0 a ${MAX_SPREAD_PCT}. Relevante pro Market Maker.`)}
            </div>
            <p className={styles.note}>
                A preferência por ordem a mercado não é editável: o campo está reservado e não muda o comportamento do bot. A mudança vale
                na próxima rodada de negociação.
            </p>
        </div>
    )
}
