import { useId } from 'react'
import {
    addOption,
    EMBEDDED_WIDGET_TYPES,
    hasAssetKey,
    MAX_BET_OPTIONS,
    MICRO_DECISION_TYPE_OPTIONS,
    MIN_BET_OPTIONS,
    removeOption,
    toggleUnlockKey,
    UNLOCK_ASSET_OPTIONS,
    UNLOCK_FEATURE_OPTIONS,
} from '../../../features/admin/lessonDraft'
import type { LessonDraft } from '../../../features/admin/lessonDraft'
import type { LessonMicroDecisionType } from '../../../services/admin'
import styles from './index.module.css'

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
    const id = useId()
    return (
        <div className={styles.field}>
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
            {children(id)}
            {hint && <span className={styles.hint}>{hint}</span>}
        </div>
    )
}

interface LessonEditorFormProps {
    draft: LessonDraft
    onChange: (draft: LessonDraft) => void
    disabled?: boolean
}

const CARD_HINT =
    'Uma linha em branco separa cartões. Comece um cartão com [revelar] para esconder o resultado atrás de um botão. {{Termo}} abre o glossário e {{ref:2.1}} vira link para outra lição, pelo código dela.'

// Formulário de conteúdo de uma lição (N.23), usado na edição e na criação. Só coleta os campos; as regras de
// verdade (aposta, chaves, ticker no catálogo) são do backend e voltam como mensagem ao salvar.
export function LessonEditorForm({ draft, onChange, disabled = false }: LessonEditorFormProps) {
    const set = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) => onChange({ ...draft, [key]: value })
    const usesWidget = EMBEDDED_WIDGET_TYPES.includes(draft.microDecisionType)
    const betName = useId()

    return (
        <form className={styles.form} onSubmit={(event) => event.preventDefault()} aria-label="Conteúdo da lição">
            <Field label="Título">
                {(id) => (
                    <input
                        id={id}
                        className={styles.input}
                        value={draft.title}
                        maxLength={150}
                        disabled={disabled}
                        onChange={(e) => set('title', e.target.value)}
                    />
                )}
            </Field>

            <Field label="Conceito central" hint="Resumo de uma frase do que a lição ensina.">
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={2}
                        value={draft.centralConcept}
                        maxLength={500}
                        disabled={disabled}
                        onChange={(e) => set('centralConcept', e.target.value)}
                    />
                )}
            </Field>

            <Field label="Cenário" hint={CARD_HINT}>
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={7}
                        value={draft.scenarioText}
                        maxLength={5000}
                        disabled={disabled}
                        onChange={(e) => set('scenarioText', e.target.value)}
                    />
                )}
            </Field>

            <Field label="Tipo de micro-decisão">
                {(id) => (
                    <select
                        id={id}
                        className={styles.input}
                        value={draft.microDecisionType}
                        disabled={disabled}
                        onChange={(e) => set('microDecisionType', e.target.value as LessonMicroDecisionType)}
                    >
                        {MICRO_DECISION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                )}
            </Field>

            {draft.microDecisionType === 'live_indicator' && (
                <Field
                    label="Ticker do ativo ao vivo"
                    hint="Precisa existir no catálogo do mercado. Os indicadores dele aparecem na Revelação."
                >
                    {(id) => (
                        <input
                            id={id}
                            className={styles.input}
                            value={draft.microDecisionAssetTicker}
                            maxLength={20}
                            disabled={disabled}
                            onChange={(e) => set('microDecisionAssetTicker', e.target.value)}
                        />
                    )}
                </Field>
            )}

            <Field label="Micro-decisão" hint={CARD_HINT}>
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={4}
                        value={draft.microDecisionPrompt}
                        maxLength={5000}
                        disabled={disabled}
                        onChange={(e) => set('microDecisionPrompt', e.target.value)}
                    />
                )}
            </Field>

            {usesWidget ? (
                <p className={styles.note}>A calculadora e o comparador já são a interação deste passo, então a lição não leva aposta.</p>
            ) : (
                <fieldset className={styles.fieldset}>
                    <legend className={styles.legend}>Aposta</legend>
                    <label className={styles.check}>
                        <input
                            type="checkbox"
                            checked={draft.hasBet}
                            disabled={disabled}
                            onChange={(e) => set('hasBet', e.target.checked)}
                        />
                        Esta lição tem aposta com resposta certa
                    </label>
                    {!draft.hasBet && (
                        <span className={styles.hint}>Sem aposta, o passo mostra só a caixa de reflexão &quot;já pensei&quot;.</span>
                    )}
                    {draft.hasBet && (
                        <div className={styles.options}>
                            {draft.options.map((option, index) => (
                                <div key={index} className={styles.optionRow}>
                                    <input
                                        type="radio"
                                        name={betName}
                                        aria-label={`Opção ${index + 1} é a correta`}
                                        checked={draft.correctOption === index}
                                        disabled={disabled}
                                        onChange={() => set('correctOption', index)}
                                    />
                                    <input
                                        className={styles.input}
                                        aria-label={`Texto da opção ${index + 1}`}
                                        value={option}
                                        maxLength={200}
                                        disabled={disabled}
                                        onChange={(e) =>
                                            set(
                                                'options',
                                                draft.options.map((current, i) => (i === index ? e.target.value : current)),
                                            )
                                        }
                                    />
                                    <button
                                        type="button"
                                        className={styles.link}
                                        disabled={disabled || draft.options.length <= MIN_BET_OPTIONS}
                                        aria-label={`Remover a opção ${index + 1}`}
                                        onClick={() => onChange(removeOption(draft, index))}
                                    >
                                        Remover
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className={styles.link}
                                disabled={disabled || draft.options.length >= MAX_BET_OPTIONS}
                                onClick={() => onChange(addOption(draft))}
                            >
                                Adicionar opção
                            </button>
                            <span className={styles.hint}>
                                De {MIN_BET_OPTIONS} a {MAX_BET_OPTIONS} opções. A marcada ao lado é a resposta certa.
                            </span>
                        </div>
                    )}
                </fieldset>
            )}

            <Field label="Revelação" hint={CARD_HINT}>
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={7}
                        value={draft.revelationText}
                        maxLength={5000}
                        disabled={disabled}
                        onChange={(e) => set('revelationText', e.target.value)}
                    />
                )}
            </Field>

            <Field label="Texto do desbloqueio" hint="O que o usuário libera ao concluir. Vazio mostra a frase padrão.">
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={2}
                        value={draft.unlocksDescription}
                        maxLength={500}
                        disabled={disabled}
                        onChange={(e) => set('unlocksDescription', e.target.value)}
                    />
                )}
            </Field>

            <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>O que a lição libera</legend>
                <div className={styles.checks}>
                    {[...UNLOCK_FEATURE_OPTIONS, ...UNLOCK_ASSET_OPTIONS].map((option) => (
                        <label key={option.key} className={styles.check}>
                            <input
                                type="checkbox"
                                checked={draft.unlocksKeys.includes(option.key)}
                                disabled={disabled}
                                onChange={() => onChange(toggleUnlockKey(draft, option.key))}
                            />
                            {option.label}
                        </label>
                    ))}
                </div>
                {hasAssetKey(draft.unlocksKeys) && (
                    <Field
                        label="Ticker do produto liberado"
                        hint="Vira o botão Comprar agora. Precisa existir no catálogo e ser de um dos tipos marcados."
                    >
                        {(id) => (
                            <input
                                id={id}
                                className={styles.input}
                                value={draft.unlocksAssetTicker}
                                maxLength={20}
                                disabled={disabled}
                                onChange={(e) => set('unlocksAssetTicker', e.target.value)}
                            />
                        )}
                    </Field>
                )}
            </fieldset>
        </form>
    )
}
