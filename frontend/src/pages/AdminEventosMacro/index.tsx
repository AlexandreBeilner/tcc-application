import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { Pagination } from '../../components/molecules/Pagination'
import { MacroEventHistoryList } from '../../components/organisms/MacroEventHistoryList'
import { buildMacroEventFilters, EMPTY_FILTER_DRAFT, STATUS_FILTER_OPTIONS } from '../../features/admin/macroEventLifecycle'
import type { MacroEventFilterDraft, TargetFilterKind } from '../../features/admin/macroEventLifecycle'
import { MACRO_EVENT_TEMPLATES } from '../../features/admin/macroEventTemplates'
import { MACRO_EVENT_RISK_CLASSES, MACRO_EVENT_SECTORS } from '../../features/admin/targetOptions'
import { useMacroEventsQuery } from '../../features/admin/useMacroEventsQuery'
import { useAssetLabels } from '../../features/market/useAssetLabels'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import styles from './index.module.css'

const TARGET_KIND_OPTIONS: SelectOption[] = [
    { value: '', label: 'Qualquer alvo' },
    { value: 'sector', label: 'Setor' },
    { value: 'risk_class', label: 'Classe de risco' },
    { value: 'asset_id', label: 'Ativo específico' },
]

// Tela 10.3 (RF14, N.11) — histórico de eventos macro, acesso restrito a `role = admin`
// (rota protegida em `router.tsx`, dentro do `AdminShell`, seção "Mercado"). Filtros por
// status, alvo e período; cada evento leva ao detalhe (impacto realizado, cancelar); o
// catálogo de templates aparece no fim, somente leitura (a edição segue via código, spec
// 3.3.3). "Novo evento" leva pra 10.2 (`CriarEventoMacro`), onde também se agenda.
export function AdminEventosMacro() {
    const navigate = useNavigate()
    const [page, setPage] = useState(1)
    const [draft, setDraft] = useState<MacroEventFilterDraft>(EMPTY_FILTER_DRAFT)
    const { filters, error: filterError } = useMemo(() => buildMacroEventFilters(draft), [draft])
    // Período inválido não consulta: a tela mostra o motivo e mantém o último resultado válido.
    const eventsQuery = useMacroEventsQuery(page, filterError ? {} : filters)
    const assetsQuery = useAssetsQuery()
    const assetLabels = useAssetLabels(assetsQuery.data?.assets)

    function updateDraft(patch: Partial<MacroEventFilterDraft>) {
        setPage(1)
        setDraft((current) => ({ ...current, ...patch }))
    }

    const targetValueOptions: SelectOption[] = useMemo(() => {
        if (draft.targetKind === 'sector') return MACRO_EVENT_SECTORS.map((value) => ({ value, label: value }))
        if (draft.targetKind === 'risk_class') return MACRO_EVENT_RISK_CLASSES.map((value) => ({ value, label: value }))
        if (draft.targetKind === 'asset_id') return Object.entries(assetLabels).map(([value, label]) => ({ value, label }))
        return []
    }, [draft.targetKind, assetLabels])

    const filtered = Object.keys(filters).length > 0

    return (
        <main className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Eventos macro</h1>
                <Button onClick={() => navigate('/admin/eventos/novo')}>Novo evento</Button>
            </div>

            <p className={styles.subtitle}>
                Histórico de eventos macro (RF13/RF14), mais recentes primeiro. Os agendados ainda não começaram e podem ser cancelados.
            </p>

            <section className={styles.filters} aria-label="Filtros do histórico">
                <label className={styles.field}>
                    <span>Status</span>
                    <Select
                        aria-label="Status"
                        value={draft.status}
                        options={STATUS_FILTER_OPTIONS}
                        onChange={(value) => updateDraft({ status: value as MacroEventFilterDraft['status'] })}
                    />
                </label>
                <label className={styles.field}>
                    <span>Alvo</span>
                    <Select
                        aria-label="Tipo de alvo"
                        value={draft.targetKind}
                        options={TARGET_KIND_OPTIONS}
                        onChange={(value) => updateDraft({ targetKind: value as TargetFilterKind, targetValue: '' })}
                    />
                </label>
                {draft.targetKind !== '' && (
                    <label className={styles.field}>
                        <span>Valor do alvo</span>
                        <Select
                            aria-label="Valor do alvo"
                            value={draft.targetValue}
                            options={[{ value: '', label: 'Escolha…' }, ...targetValueOptions]}
                            onChange={(value) => updateDraft({ targetValue: value })}
                        />
                    </label>
                )}
                <label className={styles.field}>
                    <span>Do dia simulado</span>
                    <input
                        className={styles.input}
                        inputMode="numeric"
                        aria-label="Do dia simulado"
                        value={draft.fromDay}
                        onChange={(event) => updateDraft({ fromDay: event.target.value })}
                    />
                </label>
                <label className={styles.field}>
                    <span>Até o dia simulado</span>
                    <input
                        className={styles.input}
                        inputMode="numeric"
                        aria-label="Até o dia simulado"
                        value={draft.toDay}
                        onChange={(event) => updateDraft({ toDay: event.target.value })}
                    />
                </label>
                {filtered && (
                    <Button variant="secondary" onClick={() => updateDraft(EMPTY_FILTER_DRAFT)}>
                        Limpar filtros
                    </Button>
                )}
            </section>

            {filterError && (
                <p className={styles.error} role="alert">
                    {filterError}
                </p>
            )}

            {eventsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o histórico agora. Tente novamente em instantes.
                </p>
            )}

            {eventsQuery.isLoading && <p className={styles.loading}>Carregando histórico…</p>}

            {eventsQuery.data && (
                <>
                    <p className={styles.total}>{eventsQuery.data.totalEntries} evento(s)</p>
                    <MacroEventHistoryList
                        events={eventsQuery.data.events}
                        assetLabels={assetLabels}
                        onSelectAsset={(assetId) => navigate(`/mercado/ativos/${assetId}`)}
                    />

                    <Pagination
                        page={eventsQuery.data.page}
                        totalPages={eventsQuery.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação do histórico de eventos macro"
                    />
                </>
            )}

            <section className={styles.catalog} aria-label="Catálogo de templates">
                <h2 className={styles.sectionTitle}>Catálogo de templates</h2>
                <p className={styles.hint}>
                    Somente leitura. Os templates vivem no código do motor (spec 3.3.3); pra disparar um, use "Novo evento".
                </p>
                <ul className={styles.templateList}>
                    {MACRO_EVENT_TEMPLATES.map((template) => (
                        <li key={template.key} className={styles.template}>
                            <details>
                                <summary className={styles.templateSummary}>
                                    <span className={styles.templateTitle}>{template.title}</span>
                                    <span className={styles.templateMeta}>
                                        {template.category} · {template.direction} · {template.band}
                                    </span>
                                </summary>
                                <p className={styles.templateNarrative}>{template.narrative}</p>
                            </details>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    )
}
