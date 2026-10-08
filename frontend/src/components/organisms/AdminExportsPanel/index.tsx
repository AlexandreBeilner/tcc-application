import { useState } from 'react'
import { Button } from '../../atoms/Button'
import { Select } from '../../atoms/Select'
import { EMPTY_EXPORT_FORM, EXPORT_DATASETS, EXPORT_MAX_ROWS, validateExportForm } from '../../../features/admin/adminExports'
import type { ExportFormValues } from '../../../features/admin/adminExports'
import type { ExportDataset } from '../../../services/admin'
import type { AdminExportsPanelProps } from './types'
import styles from './index.module.css'

export type { AdminExportsPanelProps } from './types'

// Exportação CSV (N.21): usuários, ordens, eventos de mercado e auditoria, com período e teto de
// linhas. Cada conjunto mostra o que contém e o que NUNCA contém (privacidade, LGPD). A exportação
// é auditada, e a de usuários (traz e-mail) pede senha recente.
export function AdminExportsPanel({ busy, lastResult, error, onDownload }: AdminExportsPanelProps) {
    const [values, setValues] = useState<ExportFormValues>(EMPTY_EXPORT_FORM)
    const [touched, setTouched] = useState(false)

    const problem = validateExportForm(values)
    const dataset = EXPORT_DATASETS.find((d) => d.value === values.dataset)
    const set = <K extends keyof ExportFormValues>(key: K, value: ExportFormValues[K]) =>
        setValues((current) => ({ ...current, [key]: value }))

    function submit() {
        setTouched(true)
        if (problem) return
        onDownload(values)
    }

    return (
        <section className={styles.panel} aria-label="Exportar dados">
            <h2 className={styles.title}>Exportar dados em CSV</h2>
            <p className={styles.text}>
                Gera um arquivo para planilha. Cada exportação fica registrada na auditoria. Sem período, traz tudo até o limite de linhas.
            </p>
            <div className={styles.row}>
                <label className={styles.field}>
                    <span>Conjunto de dados</span>
                    <Select
                        aria-label="Conjunto de dados"
                        value={values.dataset}
                        options={EXPORT_DATASETS.map((d) => ({ value: d.value, label: d.label }))}
                        onChange={(value) => set('dataset', value as ExportDataset)}
                    />
                </label>
                <label className={styles.field}>
                    <span>De (opcional)</span>
                    <input
                        className={styles.input}
                        type="datetime-local"
                        value={values.from}
                        onChange={(event) => set('from', event.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    <span>Até (opcional)</span>
                    <input
                        className={styles.input}
                        type="datetime-local"
                        value={values.to}
                        onChange={(event) => set('to', event.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    <span>Limite de linhas (até {EXPORT_MAX_ROWS.toLocaleString('pt-BR')})</span>
                    <input
                        className={styles.input}
                        inputMode="numeric"
                        value={values.limit}
                        placeholder="10.000"
                        onChange={(event) => set('limit', event.target.value.replace(/[^\d]/g, ''))}
                    />
                </label>
            </div>
            {dataset && <p className={styles.hint}>{dataset.hint}</p>}
            {touched && problem && (
                <p className={styles.error} role="alert">
                    {problem}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <div>
                <Button disabled={busy} onClick={submit}>
                    {busy ? 'Gerando…' : 'Baixar CSV'}
                </Button>
            </div>
            {lastResult && (
                <p className={lastResult.truncated ? styles.warn : styles.ok} role="status">
                    {lastResult.filename}: {lastResult.rows.toLocaleString('pt-BR')} {lastResult.rows === 1 ? 'linha' : 'linhas'}.
                    {lastResult.truncated ? ' O arquivo foi cortado no limite: há mais linhas. Estreite o período ou suba o limite.' : ''}
                </p>
            )}
        </section>
    )
}
