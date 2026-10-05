import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../atoms/Button'
import { Select } from '../../atoms/Select'
import type { SelectOption } from '../../atoms/Select'
import { defaultBotFormValues, validateBotForm, WITHIN_SCOPE_RANGE, MAX_SPREAD_PCT } from '../../../features/admin/botForm'
import type { BotFormErrors, BotFormValues } from '../../../features/admin/botForm'
import {
    ARCHETYPES,
    ARCHETYPE_LABELS,
    ASSET_CLASS_LABELS,
    BOT_ASSET_CLASSES,
    BOT_RISK_CLASSES,
    BOT_SECTORS,
} from '../../../features/admin/botLabels'
import type { BotArchetype } from '../../../services/admin'
import type { BotCreateFormProps } from './types'
import styles from './index.module.css'

export type { BotCreateFormProps } from './types'

const ARCHETYPE_OPTIONS: SelectOption[] = ARCHETYPES.map((value) => ({ value, label: ARCHETYPE_LABELS[value] }))

const ARCHETYPE_HINTS: Record<BotArchetype, string> = {
    ruido: 'Negocia sem critério de preço, só dá liquidez e movimento ao book.',
    market_maker: 'Cota compra e venda ao redor do preço. Nasce sem cobertura: assume o próximo ativo novo ou recebe ativos pela tabela.',
    chartista: 'Decide pela tendência do histórico de preço.',
    fundamentalista: 'Decide pelo preço justo calculado dos fundamentos, conforme o nível de conhecimento.',
}

function toggle(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

// Criação de bot (N.2). Percentuais em porcentagem (90 para 90%), como o admin pensa; a
// conversão para fração e as faixas vivem em `features/admin/botForm`. Campo de outro
// arquétipo nem aparece: conhecimento só no Fundamentalista, teto de cobertura só no Market Maker.
export function BotCreateForm({ onSubmit, pending, errorMessage }: BotCreateFormProps) {
    const [values, setValues] = useState<BotFormValues>(() => defaultBotFormValues())
    const [errors, setErrors] = useState<BotFormErrors>({})

    const set = <K extends keyof BotFormValues>(key: K, value: BotFormValues[K]) => setValues((current) => ({ ...current, [key]: value }))

    function changeArchetype(value: string) {
        const archetype = value as BotArchetype
        // Trocar o arquétipo troca os padrões que dependem dele, mas preserva escopo e caixa já digitados.
        setValues((current) => ({
            ...defaultBotFormValues(archetype),
            sectors: current.sectors,
            riskClasses: current.riskClasses,
            assetClasses: current.assetClasses,
            withinScopePct: current.withinScopePct,
            initialCash: current.initialCash,
        }))
        setErrors({})
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault()
        const found = validateBotForm(values)
        setErrors(found)
        if (Object.keys(found).length === 0) onSubmit(values)
    }

    const textField = (key: keyof BotFormValues, label: string, hint?: string) => (
        <label className={styles.field}>
            <span>{label}</span>
            <input
                className={styles.input}
                inputMode="decimal"
                value={values[key] as string}
                onChange={(event) => set(key, event.target.value as never)}
                aria-invalid={errors[key] ? true : undefined}
            />
            {hint && !errors[key] && <span className={styles.hint}>{hint}</span>}
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
        <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="Novo bot">
            <label className={styles.field}>
                <span>Arquétipo</span>
                <Select aria-label="Arquétipo do bot" value={values.archetype} options={ARCHETYPE_OPTIONS} onChange={changeArchetype} />
                <span className={styles.hint}>{ARCHETYPE_HINTS[values.archetype]}</span>
            </label>

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
                {values.archetype === 'fundamentalista' && textField('knowledgeLevelPct', 'Nível de conhecimento (%)', 'De 0 a 100.')}
                {textField('maxPositionSizePct', 'Tamanho máximo de posição por ordem (%)', 'Fração do caixa ou da posição numa ordem.')}
                {textField(
                    'marketOrderPreferencePct',
                    'Preferência por ordem a mercado (%)',
                    '0 é sempre limitada, 100 é sempre a mercado.',
                )}
                {textField('spreadWidthPct', 'Largura do spread (%)', `De 0 a ${MAX_SPREAD_PCT}. Relevante pro Market Maker.`)}
                {values.archetype === 'market_maker' &&
                    textField('maxCoveredAssets', 'Teto de ativos cobertos', 'Vazio usa o padrão (10).')}
                {textField('initialCash', 'Caixa inicial (R$)', 'O bot começa só com caixa e ganha posição negociando.')}
            </div>

            {errorMessage && (
                <p className={styles.error} role="alert">
                    {errorMessage}
                </p>
            )}
            <Button type="submit" disabled={pending}>
                {pending ? 'Criando…' : 'Criar bot'}
            </Button>
        </form>
    )
}
