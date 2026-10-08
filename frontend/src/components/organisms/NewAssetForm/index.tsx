import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../atoms/Button'
import { Select } from '../../atoms/Select'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import {
    buildNewAsset,
    defaultNewAssetDraft,
    describeNewAssetError,
    holdingsTotal,
    MAX_ETF_HOLDINGS,
    NEW_ASSET_KIND_LABELS,
    NEW_ASSET_KINDS,
    NEW_ASSET_SECTORS,
} from '../../../features/admin/newAsset'
import type { NewAssetDraft, NewAssetErrors, NewAssetFailure } from '../../../features/admin/newAsset'
import type { NewCatalogAsset, NewCatalogAssetKind, NewCatalogAssetPreview } from '../../../services/admin'
import type { NewAssetFormProps } from './types'
import styles from './index.module.css'

export type { NewAssetFormProps } from './types'

const number = (value: number) => value.toLocaleString('pt-BR')

// Cadastro de ativo novo (N.13). Um formulário por classe (RF21), com o preview do que será
// criado (bots novos, Market Maker que cobre, float distribuído) antes de confirmar. Mudar
// qualquer campo depois do preview invalida o preview: o que se confirma é o que se viu.
export function NewAssetForm({ onPreview, onCreate, onCreated, onCancel }: NewAssetFormProps) {
    const [kind, setKind] = useState<NewCatalogAssetKind>('acao')
    const [draft, setDraft] = useState<NewAssetDraft>(() => defaultNewAssetDraft())
    const [errors, setErrors] = useState<NewAssetErrors>({})
    const [failure, setFailure] = useState<NewAssetFailure | null>(null)
    const [previewed, setPreviewed] = useState<{ asset: NewCatalogAsset; preview: NewCatalogAssetPreview } | null>(null)
    const [busy, setBusy] = useState(false)
    const [confirming, setConfirming] = useState(false)

    const edit = (patch: Partial<NewAssetDraft>) => {
        setDraft((current) => ({ ...current, ...patch }))
        setPreviewed(null)
        setFailure(null)
    }

    function changeKind(value: string) {
        setKind(value as NewCatalogAssetKind)
        setErrors({})
        setPreviewed(null)
        setFailure(null)
    }

    async function handlePreview(event: FormEvent) {
        event.preventDefault()
        setFailure(null)
        const built = buildNewAsset(kind, draft)
        if ('errors' in built) {
            setErrors(built.errors)
            setPreviewed(null)
            return
        }
        setErrors({})
        setBusy(true)
        try {
            setPreviewed({ asset: built.asset, preview: await onPreview(built.asset) })
        } catch (err) {
            const found = describeNewAssetError(err)
            setFailure(found)
            if (found.field) setErrors({ [found.field]: found.message })
        } finally {
            setBusy(false)
        }
    }

    async function handleCreate() {
        if (!previewed) return
        setBusy(true)
        try {
            onCreated(await onCreate(previewed.asset))
        } catch (err) {
            setFailure(describeNewAssetError(err))
        } finally {
            setBusy(false)
            setConfirming(false)
        }
    }

    const field = (
        key: keyof NewAssetDraft,
        label: string,
        props: { hint?: string; inputMode?: 'text' | 'decimal' | 'numeric'; placeholder?: string } = {},
    ) => (
        <label className={styles.field}>
            <span>{label}</span>
            <input
                className={styles.input}
                inputMode={props.inputMode ?? 'text'}
                placeholder={props.placeholder}
                value={draft[key] as string}
                aria-invalid={errors[key] ? true : undefined}
                onChange={(event) => edit({ [key]: event.target.value })}
            />
            {props.hint && <span className={styles.hint}>{props.hint}</span>}
            {errors[key] && (
                <span className={styles.fieldError} role="alert">
                    {errors[key]}
                </span>
            )}
        </label>
    )

    const preview = previewed?.preview

    return (
        <form className={styles.form} onSubmit={handlePreview} aria-label="Cadastrar ativo novo">
            <h2 className={styles.title}>Cadastrar ativo novo</h2>
            <p className={styles.intro}>
                O ativo entra no mercado na rodada seguinte. O pool de bots cresce junto e o float é distribuído só no ativo novo: nenhuma
                posição de ativo existente muda. Não há exclusão depois de criado.
            </p>

            <label className={styles.field}>
                <span>Classe</span>
                <Select
                    value={kind}
                    onChange={changeKind}
                    options={NEW_ASSET_KINDS.map((value) => ({ value, label: NEW_ASSET_KIND_LABELS[value] }))}
                    aria-label="Classe do ativo novo"
                />
            </label>

            <div className={styles.grid}>
                {field('ticker', 'Ticker', {
                    placeholder: kind === 'acao' ? 'ABCD3' : 'ABCD11',
                    hint: kind === 'acao' ? 'Ação ON termina em 3.' : 'FII e ETF terminam em 11.',
                })}
                {field('name', 'Nome')}

                {kind === 'acao' && (
                    <>
                        {field('company_name', 'Empresa emissora')}
                        {field('cnpj', 'CNPJ', { inputMode: 'numeric', placeholder: '00.000.000/0000-00' })}
                        <label className={styles.field}>
                            <span>Setor</span>
                            <Select
                                value={draft.sector}
                                onChange={(value) => edit({ sector: value })}
                                options={NEW_ASSET_SECTORS.map((sector) => ({ value: sector, label: sector }))}
                                aria-label="Setor da empresa"
                            />
                            <span className={styles.hint}>
                                Define a classe de risco e quais eventos macro atingem a empresa. Não muda depois.
                            </span>
                        </label>
                        {field('outstanding_shares', 'Ações em circulação', {
                            inputMode: 'numeric',
                            hint: 'É o float total. Não muda depois: mexer nele reescreve a distribuição dos bots.',
                        })}
                        {field('base_growth_pct', 'Crescimento base por ciclo (%)', { inputMode: 'decimal' })}
                        {field('quality_multiplier', 'Multiplicador de qualidade', {
                            inputMode: 'decimal',
                            hint: 'De 0 (exclusive) a 2. 1 é a média do setor.',
                        })}
                    </>
                )}

                {kind === 'fii_tijolo' && (
                    <>
                        {field('segment', 'Segmento', { placeholder: 'Lajes Corporativas', hint: 'Define o P/VP-alvo do fundo.' })}
                        {field('vacancy_rate', 'Vacância (%)', { inputMode: 'decimal' })}
                    </>
                )}

                {kind === 'fii_papel' && (
                    <label className={styles.field}>
                        <span>Indexador</span>
                        <Select
                            value={draft.indexador}
                            onChange={(value) => edit({ indexador: value as NewAssetDraft['indexador'] })}
                            options={[
                                { value: 'CDI', label: 'CDI' },
                                { value: 'IPCA+', label: 'IPCA+' },
                            ]}
                            aria-label="Indexador do FII de papel"
                        />
                    </label>
                )}

                {kind === 'etf' && (
                    <>
                        {field('benchmark_index', 'Índice de referência')}
                        <label className={`${styles.field} ${styles.wide}`}>
                            <span>Metodologia</span>
                            <textarea
                                className={styles.input}
                                rows={3}
                                maxLength={1000}
                                value={draft.methodology}
                                onChange={(event) => edit({ methodology: event.target.value })}
                            />
                            {errors.methodology && (
                                <span className={styles.fieldError} role="alert">
                                    {errors.methodology}
                                </span>
                            )}
                        </label>
                    </>
                )}
            </div>

            {kind === 'etf' && (
                <fieldset className={styles.holdings}>
                    <legend>Cesta (só ações e FIIs já cadastrados)</legend>
                    {draft.holdings.map((row, index) => (
                        <div key={index} className={styles.holdingRow}>
                            <input
                                className={styles.input}
                                aria-label={`Ticker do constituinte ${index + 1}`}
                                placeholder="VALR3"
                                value={row.ticker}
                                onChange={(event) =>
                                    edit({
                                        holdings: draft.holdings.map((h, i) => (i === index ? { ...h, ticker: event.target.value } : h)),
                                    })
                                }
                            />
                            <input
                                className={styles.input}
                                aria-label={`Peso do constituinte ${index + 1} (%)`}
                                inputMode="decimal"
                                placeholder="%"
                                value={row.weight_pct}
                                onChange={(event) =>
                                    edit({
                                        holdings: draft.holdings.map((h, i) =>
                                            i === index ? { ...h, weight_pct: event.target.value } : h,
                                        ),
                                    })
                                }
                            />
                            <Button
                                variant="secondary"
                                disabled={draft.holdings.length === 1}
                                onClick={() => edit({ holdings: draft.holdings.filter((_, i) => i !== index) })}
                            >
                                Remover
                            </Button>
                        </div>
                    ))}
                    <div className={styles.holdingFooter}>
                        <Button
                            variant="secondary"
                            disabled={draft.holdings.length >= MAX_ETF_HOLDINGS}
                            onClick={() => edit({ holdings: [...draft.holdings, { ticker: '', weight_pct: '' }] })}
                        >
                            Adicionar constituinte
                        </Button>
                        <span className={styles.hint}>
                            Soma dos pesos: {holdingsTotal(draft.holdings).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                        </span>
                    </div>
                    {errors.holdings && (
                        <span className={styles.fieldError} role="alert">
                            {errors.holdings}
                        </span>
                    )}
                </fieldset>
            )}

            {failure && !failure.field && (
                <p className={styles.error} role="alert">
                    {failure.message}
                </p>
            )}

            {preview && (
                <section className={styles.preview} aria-label="O que será criado">
                    <h3 className={styles.previewTitle}>O que será criado</h3>
                    <p className={styles.previewLine}>
                        {NEW_ASSET_KIND_LABELS[kind]} <strong>{preview.ticker}</strong>, {preview.name}.
                    </p>
                    {preview.pool ? (
                        <ul className={styles.previewList}>
                            <li>
                                Bots direcionais: {preview.pool.pool_before} para {preview.pool.pool_after}
                                {preview.pool.new_bots > 0
                                    ? ` (${preview.pool.new_bots} novos, com caixa e personalidade)`
                                    : ' (o pool já comporta o ativo)'}
                                .
                            </li>
                            <li>
                                Float de {number(preview.outstanding_shares ?? 0)} cotas: {number(preview.pool.market_maker_shares)} para o
                                Market Maker e {number(preview.pool.bot_shares)} distribuídas entre os bots.
                            </li>
                            <li>
                                Cobertura:{' '}
                                {preview.pool.creates_market_maker ? 'um Market Maker novo será criado' : 'Market Maker existente'} (
                                {preview.pool.market_maker_id}).
                            </li>
                            <li>Nenhuma posição de ativo existente muda.</li>
                        </ul>
                    ) : (
                        <p className={styles.previewLine}>
                            O ETF nasce sem cotas: não tem float de bots nem Market Maker. A liquidez vem da criação de cotas pelo
                            Participante Autorizado, a partir da cesta.
                        </p>
                    )}
                </section>
            )}

            <div className={styles.actions}>
                {preview ? (
                    <Button disabled={busy} onClick={() => setConfirming(true)}>
                        Cadastrar ativo
                    </Button>
                ) : (
                    <Button type="submit" disabled={busy}>
                        {busy ? 'Calculando…' : 'Ver o que será criado'}
                    </Button>
                )}
                <Button variant="secondary" onClick={onCancel}>
                    Cancelar
                </Button>
            </div>

            {confirming && previewed && (
                <ConfirmDialog
                    title={`Cadastrar ${previewed.preview.ticker}?`}
                    confirmLabel="Cadastrar"
                    pendingLabel="Cadastrando…"
                    pending={busy}
                    requireText={previewed.preview.ticker}
                    onConfirm={handleCreate}
                    onCancel={() => setConfirming(false)}
                >
                    <p>
                        O ativo entra no mercado de todos os usuários e não pode ser excluído. A ação fica registrada na auditoria. Digite o
                        ticker pra confirmar.
                    </p>
                </ConfirmDialog>
            )}
        </form>
    )
}
