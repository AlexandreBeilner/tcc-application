import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../atoms/Button'
import { Select } from '../../atoms/Select'
import type { SelectOption } from '../../atoms/Select'
import { OrderSummaryList } from '../OrderSummaryList'
import { useAssetLabels } from '../../../features/market/useAssetLabels'
import { useAssetsQuery } from '../../../features/market/useAssetsQuery'
import { MACRO_EVENT_TEMPLATES } from '../../../features/admin/macroEventTemplates'
import { MACRO_EVENT_RISK_CLASSES, MACRO_EVENT_SECTORS } from '../../../features/admin/targetOptions'
import {
    buildMacroEventSummaryRows,
    buildTriggerMacroEventInput,
    createEmptyMacroEventDraft,
    createEmptyTarget,
    validateMacroEventDraft,
} from '../../../features/admin/macroEventDraft'
import type { MacroEventDraft, MacroEventTargetDraft, MacroEventTargetKind } from '../../../features/admin/macroEventDraft'
import { useTriggerMacroEventMutation } from '../../../features/admin/useTriggerMacroEventMutation'
import { formatApiError } from '../../../utils/formatApiError'
import type { MacroEventTriggerFormProps } from './types'
import styles from './index.module.css'

export type { MacroEventTriggerFormProps } from './types'

const TEMPLATE_OPTIONS: SelectOption[] = [
    { value: '', label: 'Selecione um template…' },
    ...MACRO_EVENT_TEMPLATES.map((template) => ({ value: template.key, label: template.title })),
]

const DIRECTION_OPTIONS: SelectOption[] = [
    { value: 'positivo', label: 'Positivo (alta)' },
    { value: 'negativo', label: 'Negativo (baixa)' },
    { value: 'misto', label: 'Misto (varia por alvo)' },
]

// Faixas de efeito da spec 3.3.2 — exibidas só como referência pro admin,
// o motor é quem de fato sorteia o valor dentro da faixa da banda.
const MAGNITUDE_OPTIONS: SelectOption[] = [
    { value: 'leve', label: 'Leve (±3–5% preço / ±5–10% fundamentos)' },
    { value: 'moderado', label: 'Moderado (±8–12% preço / ±10–20% fundamentos)' },
    { value: 'severo', label: 'Severo (±15–25% preço / ±20–35% fundamentos)' },
]

const TARGET_KIND_OPTIONS: SelectOption[] = [
    { value: 'sector', label: 'Setor' },
    { value: 'risk_class', label: 'Classe de risco' },
    { value: 'asset', label: 'Ativo específico' },
]

const SECTOR_OPTIONS: SelectOption[] = [
    { value: '', label: 'Selecione um setor…' },
    ...MACRO_EVENT_SECTORS.map((sector) => ({ value: sector, label: sector })),
]

const RISK_CLASS_OPTIONS: SelectOption[] = [
    { value: '', label: 'Selecione uma classe de risco…' },
    ...MACRO_EVENT_RISK_CLASSES.map((riskClass) => ({ value: riskClass, label: riskClass })),
]

// Tela 10.2 (RF13) — um formulário só, alternando "usar template" vs.
// "evento avulso" via toggle (backlog 6.11: o schema Zod do backend já
// unifica as duas variantes num único endpoint, não faz sentido duplicar
// em dois formulários visualmente distintos). "Disparar agora" abre um
// diálogo de confirmação (mesma convenção de ação importante do Detalhe de
// Ativo — identidade-visual-padroes.md §7) antes de chamar `POST /admin/
// macro-events` de verdade; sucesso chama `onTriggered` (a tela volta pro
// histórico, 10.1, onde o evento novo aparece no topo — cache já invalidado
// por `useTriggerMacroEventMutation`).
export function MacroEventTriggerForm({ onTriggered }: MacroEventTriggerFormProps) {
    const [draft, setDraft] = useState<MacroEventDraft>(createEmptyMacroEventDraft)
    const [clientErrors, setClientErrors] = useState<string[]>([])
    const [confirming, setConfirming] = useState(false)

    // Só ação é alvo válido de evento macro (o efeito é por empresa); FII, ETF e renda fixa são recusados
    // pelo motor (achado 028), então nem aparecem no seletor.
    const assetsQuery = useAssetsQuery('acao')
    const triggerMutation = useTriggerMacroEventMutation()
    const assetLabels = useAssetLabels(assetsQuery.data?.assets)

    const assetOptions: SelectOption[] = useMemo(
        () => [{ value: '', label: 'Selecione um ativo…' }, ...Object.entries(assetLabels).map(([value, label]) => ({ value, label }))],
        [assetLabels],
    )

    function updateDraft(patch: Partial<MacroEventDraft>) {
        setDraft((current) => ({ ...current, ...patch }))
    }

    function updateTarget(id: string, patch: Partial<MacroEventTargetDraft>) {
        setDraft((current) => ({
            ...current,
            targets: current.targets.map((target) => (target.id === id ? { ...target, ...patch } : target)),
        }))
    }

    function changeTargetKind(id: string, kind: MacroEventTargetKind) {
        // Zera o valor ao trocar de tipo — o valor anterior (nome de setor,
        // classe de risco ou id de ativo) não faz sentido pro novo tipo.
        updateTarget(id, { kind, value: '' })
    }

    function addTarget() {
        setDraft((current) => ({ ...current, targets: [...current.targets, createEmptyTarget()] }))
    }

    function removeTarget(id: string) {
        setDraft((current) => ({ ...current, targets: current.targets.filter((target) => target.id !== id) }))
    }

    function handleOpenConfirm() {
        const errors = validateMacroEventDraft(draft)
        setClientErrors(errors)
        if (errors.length === 0) setConfirming(true)
    }

    async function handleConfirm() {
        try {
            await triggerMutation.mutateAsync(buildTriggerMacroEventInput(draft))
            onTriggered()
        } catch {
            // Erro exibido abaixo via `triggerMutation.error` — diálogo
            // continua aberto pro admin tentar de novo ou cancelar.
        }
    }

    const summaryRows = buildMacroEventSummaryRows(draft, assetLabels)
    const triggerErrorMessage = triggerMutation.isError
        ? formatApiError(triggerMutation.error, 'Não foi possível disparar o evento agora. Tente novamente.')
        : null

    return (
        <div className={styles.layout}>
            <div className={styles.form}>
                <div className={styles.modeToggle} role="group" aria-label="Origem do evento">
                    <Button
                        type="button"
                        variant={draft.mode === 'template' ? 'primary' : 'secondary'}
                        onClick={() => updateDraft({ mode: 'template' })}
                    >
                        Usar template do catálogo
                    </Button>
                    <Button
                        type="button"
                        variant={draft.mode === 'adhoc' ? 'primary' : 'secondary'}
                        onClick={() => updateDraft({ mode: 'adhoc' })}
                    >
                        Criar evento avulso
                    </Button>
                </div>

                {draft.mode === 'template' ? (
                    <label className={styles.field}>
                        Template
                        <Select
                            aria-label="Template"
                            value={draft.templateKey}
                            onChange={(value) => updateDraft({ templateKey: value })}
                            options={TEMPLATE_OPTIONS}
                        />
                    </label>
                ) : (
                    <>
                        <label className={styles.field}>
                            Título
                            <input
                                type="text"
                                maxLength={150}
                                value={draft.title}
                                onChange={(e) => updateDraft({ title: e.target.value })}
                                placeholder="Ex: Nova legislação ambiental restringe atividade de mineração"
                            />
                        </label>
                        <label className={styles.field}>
                            Narrativa
                            <textarea
                                rows={4}
                                value={draft.narrative}
                                onChange={(e) => updateDraft({ narrative: e.target.value })}
                                placeholder="Explique o evento de forma didática, este texto aparece pro jogador no Feed de Notícias."
                            />
                        </label>
                        <div className={styles.fieldRow}>
                            <label className={styles.field}>
                                Direção
                                <Select
                                    aria-label="Direção"
                                    value={draft.direction}
                                    onChange={(value) => updateDraft({ direction: value as MacroEventDraft['direction'] })}
                                    options={DIRECTION_OPTIONS}
                                />
                            </label>
                            <label className={styles.field}>
                                Banda de magnitude
                                <Select
                                    aria-label="Banda de magnitude"
                                    value={draft.magnitudeBand}
                                    onChange={(value) => updateDraft({ magnitudeBand: value as MacroEventDraft['magnitudeBand'] })}
                                    options={MAGNITUDE_OPTIONS}
                                />
                            </label>
                        </div>
                        <div className={styles.checkboxRow}>
                            <label className={styles.checkboxField}>
                                <input
                                    type="checkbox"
                                    checked={draft.affectsPrice}
                                    onChange={(e) => updateDraft({ affectsPrice: e.target.checked })}
                                />
                                Afeta preço
                            </label>
                            <label className={styles.checkboxField}>
                                <input
                                    type="checkbox"
                                    checked={draft.affectsFundamentals}
                                    onChange={(e) => updateDraft({ affectsFundamentals: e.target.checked })}
                                />
                                Afeta fundamentos
                            </label>
                        </div>
                    </>
                )}

                <div className={styles.targets}>
                    <span className={styles.sectionLabel}>Alvos</span>
                    {draft.targets.map((target) => (
                        <div key={target.id} className={styles.targetRow}>
                            <Select
                                aria-label="Tipo de alvo"
                                value={target.kind}
                                onChange={(value) => changeTargetKind(target.id, value as MacroEventTargetKind)}
                                options={TARGET_KIND_OPTIONS}
                            />
                            {target.kind === 'sector' && (
                                <Select
                                    aria-label="Setor"
                                    value={target.value}
                                    onChange={(value) => updateTarget(target.id, { value })}
                                    options={SECTOR_OPTIONS}
                                />
                            )}
                            {target.kind === 'risk_class' && (
                                <Select
                                    aria-label="Classe de risco"
                                    value={target.value}
                                    onChange={(value) => updateTarget(target.id, { value })}
                                    options={RISK_CLASS_OPTIONS}
                                />
                            )}
                            {target.kind === 'asset' && (
                                <Select
                                    aria-label="Ativo"
                                    value={target.value}
                                    onChange={(value) => updateTarget(target.id, { value })}
                                    options={assetOptions}
                                />
                            )}
                            <button
                                type="button"
                                className={styles.removeTarget}
                                disabled={draft.targets.length <= 1}
                                onClick={() => removeTarget(target.id)}
                                aria-label="Remover alvo"
                            >
                                <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={addTarget}>
                        <Plus size={16} strokeWidth={2} aria-hidden="true" /> Adicionar alvo
                    </Button>
                </div>

                {clientErrors.length > 0 && (
                    <ul className={styles.error} role="alert">
                        {clientErrors.map((error) => (
                            <li key={error}>{error}</li>
                        ))}
                    </ul>
                )}

                <Button onClick={handleOpenConfirm}>Disparar agora</Button>
            </div>

            <aside className={styles.preview} aria-label="Prévia do evento">
                <span className={styles.sectionLabel}>Prévia</span>
                <OrderSummaryList rows={summaryRows} />
            </aside>

            {confirming && (
                <div
                    className={styles.backdrop}
                    onMouseDown={(e) => e.target === e.currentTarget && !triggerMutation.isPending && setConfirming(false)}
                >
                    <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="confirm-trigger-title">
                        <h2 id="confirm-trigger-title" className={styles.panelTitle}>
                            Confirmar disparo
                        </h2>

                        <OrderSummaryList rows={summaryRows} />

                        {triggerErrorMessage && (
                            <p className={styles.error} role="alert">
                                {triggerErrorMessage}
                            </p>
                        )}

                        <div className={styles.actions}>
                            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={triggerMutation.isPending}>
                                Cancelar
                            </Button>
                            <Button onClick={() => void handleConfirm()} disabled={triggerMutation.isPending}>
                                Confirmar disparo
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
