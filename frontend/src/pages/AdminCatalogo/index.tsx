import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import {
    buildCatalogPatch,
    catalogTypeLabel,
    CLASS_LABELS,
    describeCatalogError,
    describePatch,
    draftFromAsset,
    FIELD_HINTS,
    FIELD_LABELS,
    filterCatalog,
    MAX_METHODOLOGY_LENGTH,
    orderedEditableFields,
} from '../../features/admin/catalog'
import type { CatalogClass, CatalogDraft, CatalogFilters } from '../../features/admin/catalog'
import { useAdminCatalogQuery } from '../../features/admin/useAdminCatalogQuery'
import { useUpdateCatalogAssetMutation } from '../../features/admin/useCatalogActions'
import type { CatalogAsset, CatalogEditableField, CatalogPatch } from '../../services/admin'
import styles from './index.module.css'

const number = (value: number, digits = 2) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

// Parâmetros somente leitura do ativo, por classe (RF21: indicadores de ação, ETF e FII não
// se misturam). Cada linha é rótulo e valor.
function readOnlyRows(asset: CatalogAsset): Array<[string, string]> {
    const rows: Array<[string, string]> = []
    if (asset.share_class) rows.push(['Classe de ação', asset.share_class])
    if (asset.outstanding_shares !== null) rows.push(['Cotas em circulação', number(asset.outstanding_shares, 0)])
    if (asset.company) {
        rows.push(['Empresa', asset.company.name], ['Setor', asset.company.sector])
        rows.push(['Ciclo de relatório', `${asset.company.report_frequency_days} dias`])
        if (!asset.editable.includes('base_growth_pct')) rows.push(['Crescimento base', `${number(asset.company.base_growth_pct)}%`])
        if (!asset.editable.includes('quality_multiplier'))
            rows.push(['Multiplicador de qualidade', number(asset.company.quality_multiplier)])
    }
    if (asset.etf) {
        rows.push(['Índice de referência', asset.etf.benchmark_index])
        rows.push(['Taxa de administração', `${number(asset.etf.expense_ratio_pct)}% ao ano`])
        rows.push(['Rebalanceamento', `a cada ${asset.etf.rebalance_frequency_days} dias`])
        rows.push(['Cesta', asset.etf.holdings.map((h) => `${h.name} ${number(h.weight_pct)}%`).join(', ') || 'sem componentes'])
    }
    if (asset.fii) {
        rows.push(['Tipo', asset.fii.fii_type === 'papel' ? 'Papel' : 'Tijolo'])
        if (asset.fii.segment) rows.push(['Segmento', asset.fii.segment])
        if (asset.fii.indexador) rows.push(['Indexador', asset.fii.indexador])
        if (asset.fii.vacancy_rate !== null) rows.push(['Vacância', `${number(asset.fii.vacancy_rate)}%`])
    }
    if (asset.fixed_income) {
        rows.push(['Emissor', asset.fixed_income.issuer_type])
        if (asset.fixed_income.interest_rate !== null) rows.push(['Taxa', `${number(asset.fixed_income.interest_rate)}%`])
        if (asset.fixed_income.maturity_date) rows.push(['Vencimento', asset.fixed_income.maturity_date])
        rows.push(['Aplicação mínima', `R$ ${number(asset.fixed_income.minimum_investment)}`])
        rows.push(['Isento de IR', asset.fixed_income.tax_exempt ? 'Sim' : 'Não'])
    }
    return rows
}

// Tela 10.13 (N.12) — "Catálogo", dentro da seção Mercado. Consulta de todos os ativos e
// ajuste de uma lista fechada de campos: nome, crescimento base e multiplicador de qualidade
// (da empresa emissora, valem pra ON e PN), metodologia do ETF. Campos estruturais (ticker,
// setor, float, ciclo de relatório) ficam somente leitura; sandbox aparece marcado e travado.
export function AdminCatalogo() {
    const [filters, setFilters] = useState<CatalogFilters>({ klass: 'all', query: '' })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState<CatalogDraft | null>(null)
    const [errors, setErrors] = useState<Partial<Record<CatalogEditableField, string>>>({})
    const [pending, setPending] = useState<{ asset: CatalogAsset; patch: CatalogPatch } | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const catalogQuery = useAdminCatalogQuery()
    const update = useUpdateCatalogAssetMutation()
    const visible = useMemo(() => (catalogQuery.data ? filterCatalog(catalogQuery.data, filters) : []), [catalogQuery.data, filters])

    function startEditing(asset: CatalogAsset) {
        setNotice(null)
        setError(null)
        setErrors({})
        setEditingId(asset.asset_id)
        setDraft(draftFromAsset(asset))
    }

    function stopEditing() {
        setEditingId(null)
        setDraft(null)
        setErrors({})
    }

    function requestSave(asset: CatalogAsset) {
        if (!draft) return
        const result = buildCatalogPatch(asset, draft)
        setErrors(result.errors)
        if (Object.keys(result.errors).length > 0) return
        if (Object.keys(result.patch).length === 0) {
            setErrors({ name: 'Nenhuma alteração pra salvar.' })
            return
        }
        setPending({ asset, patch: result.patch })
    }

    function confirmPending() {
        if (!pending) return
        const { asset, patch } = pending
        update.mutate(
            { assetId: asset.asset_id, patch },
            {
                onSuccess: () => {
                    setNotice(`${asset.ticker} atualizado. A mudança vale a partir do próximo relatório e fica na auditoria.`)
                    stopEditing()
                },
                onError: (err) => setError(describeCatalogError(err)),
                onSettled: () => setPending(null),
            },
        )
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Catálogo de ativos</h1>
                    <p className={styles.subtitle}>
                        Parâmetros de cada ativo. Só nome, crescimento base, multiplicador de qualidade e metodologia do ETF podem ser
                        ajustados. O resto é estrutural: mudar ticker, setor ou cotas em circulação reescreve a distribuição dos bots e os
                        eventos macro que atingem a empresa.
                    </p>
                </div>
                <Link to="/admin/mercado" className={styles.link}>
                    Voltar ao Mercado
                </Link>
            </header>

            <div className={styles.filters}>
                <label className={styles.filterField}>
                    <span>Classe</span>
                    <Select
                        value={filters.klass}
                        onChange={(value) => setFilters({ ...filters, klass: value as CatalogClass | 'all' })}
                        options={[
                            { value: 'all', label: 'Todas' },
                            ...(Object.keys(CLASS_LABELS) as CatalogClass[]).map((klass) => ({ value: klass, label: CLASS_LABELS[klass] })),
                        ]}
                        aria-label="Filtrar por classe"
                    />
                </label>
                <label className={styles.filterField}>
                    <span>Buscar</span>
                    <input
                        className={styles.search}
                        type="search"
                        value={filters.query}
                        placeholder="Ticker ou nome"
                        onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                    />
                </label>
            </div>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {catalogQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o catálogo agora. Tente novamente em instantes.
                </p>
            )}
            {catalogQuery.isLoading && <p className={styles.loading}>Carregando catálogo…</p>}
            {catalogQuery.data && visible.length === 0 && <p className={styles.loading}>Nenhum ativo com esses filtros.</p>}

            <div className={styles.cards}>
                {visible.map((asset) => {
                    const editing = editingId === asset.asset_id && draft !== null
                    const fields = orderedEditableFields(asset)
                    return (
                        <article key={asset.asset_id} className={styles.card} aria-label={asset.ticker}>
                            <header className={styles.cardHead}>
                                <div>
                                    <h2 className={styles.cardTitle}>{asset.ticker}</h2>
                                    <p className={styles.cardName}>{asset.name}</p>
                                </div>
                                <div className={styles.badges}>
                                    <span className={styles.badge}>{catalogTypeLabel(asset.type)}</span>
                                    {asset.is_sandbox && <span className={styles.badgeDashed}>Sandbox</span>}
                                </div>
                            </header>

                            {!editing && fields.includes('base_growth_pct') && asset.company && (
                                <dl className={styles.params}>
                                    <div>
                                        <dt>Crescimento base</dt>
                                        <dd>{number(asset.company.base_growth_pct)}% por ciclo</dd>
                                    </div>
                                    <div>
                                        <dt>Multiplicador de qualidade</dt>
                                        <dd>{number(asset.company.quality_multiplier)}</dd>
                                    </div>
                                </dl>
                            )}
                            {!editing && fields.includes('methodology_summary') && asset.etf && (
                                <p className={styles.methodology}>{asset.etf.methodology_summary ?? 'Sem metodologia cadastrada.'}</p>
                            )}

                            <dl className={styles.readOnly} aria-label="Somente leitura">
                                {readOnlyRows(asset).map(([label, value]) => (
                                    <div key={label}>
                                        <dt>{label}</dt>
                                        <dd>{value}</dd>
                                    </div>
                                ))}
                            </dl>

                            {asset.is_sandbox && <p className={styles.meta}>Ativo do sandbox de aprendizado: não é editável.</p>}

                            {editing && draft && (
                                <form
                                    className={styles.form}
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                        requestSave(asset)
                                    }}
                                >
                                    {fields.map((field) => (
                                        <label key={field} className={styles.field}>
                                            <span>{FIELD_LABELS[field]}</span>
                                            {field === 'methodology_summary' ? (
                                                <textarea
                                                    className={styles.input}
                                                    rows={4}
                                                    maxLength={MAX_METHODOLOGY_LENGTH}
                                                    value={draft[field]}
                                                    aria-invalid={errors[field] ? true : undefined}
                                                    onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                                />
                                            ) : (
                                                <input
                                                    className={styles.input}
                                                    inputMode={field === 'name' ? 'text' : 'decimal'}
                                                    value={draft[field]}
                                                    aria-invalid={errors[field] ? true : undefined}
                                                    onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                                />
                                            )}
                                            <span className={styles.meta}>{FIELD_HINTS[field]}</span>
                                            {errors[field] && (
                                                <span className={styles.fieldError} role="alert">
                                                    {errors[field]}
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                    <div className={styles.actions}>
                                        <Button type="submit" disabled={update.isPending}>
                                            Salvar
                                        </Button>
                                        <Button variant="secondary" onClick={stopEditing}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {!editing && fields.length > 0 && (
                                <div className={styles.actions}>
                                    <Button variant="secondary" onClick={() => startEditing(asset)}>
                                        Editar {asset.ticker}
                                    </Button>
                                </div>
                            )}
                        </article>
                    )
                })}
            </div>

            {pending && (
                <ConfirmDialog
                    title={`Alterar ${pending.asset.ticker}?`}
                    confirmLabel="Alterar"
                    pendingLabel="Salvando…"
                    pending={update.isPending}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <ul className={styles.diff}>
                        {describePatch(pending.asset, pending.patch).map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                    <p>
                        Afeta todos os usuários.
                        {pending.asset.company ? ' Parâmetros da empresa valem pra todas as classes de ação do emissor.' : ''} A ação fica
                        registrada na auditoria.
                    </p>
                </ConfirmDialog>
            )}
        </main>
    )
}
