import { useMemo, useState } from 'react'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { Pagination } from '../../components/molecules/Pagination'
import { AuditLogList } from '../../components/organisms/AuditLogList'
import { AUDIT_ACTION_LABELS, AUDIT_RESULT_LABELS } from '../../features/admin/auditLabels'
import { useAuditLogQuery } from '../../features/admin/useAuditLogQuery'
import type { AuditAction, AuditResult } from '../../services/admin'
import styles from './index.module.css'

const ACTION_OPTIONS: SelectOption[] = [
    { value: '', label: 'Todas as ações' },
    ...(Object.entries(AUDIT_ACTION_LABELS) as [AuditAction, string][]).map(([value, label]) => ({ value, label })),
]

const RESULT_OPTIONS: SelectOption[] = [
    { value: '', label: 'Qualquer resultado' },
    ...(Object.entries(AUDIT_RESULT_LABELS) as [AuditResult, string][]).map(([value, label]) => ({ value, label })),
]

// `<input type="date">` entrega 'AAAA-MM-DD' no fuso do navegador; o backend
// quer ISO 8601 com fuso. Início do dia local pro "de", fim do dia local pro "até".
function startOfDayIso(date: string): string | undefined {
    return date ? new Date(`${date}T00:00:00`).toISOString() : undefined
}

function endOfDayIso(date: string): string | undefined {
    return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
}

// Tela 10.4 (N.4) — log de auditoria das ações administrativas, seção
// "Auditoria" do painel. Só leitura: o log é append-only (backend + banco).
export function AdminAuditoria() {
    const [action, setAction] = useState('')
    const [result, setResult] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [page, setPage] = useState(1)

    const invalidRange = fromDate !== '' && toDate !== '' && fromDate > toDate

    const filters = useMemo(
        () => ({
            action: (action || undefined) as AuditAction | undefined,
            result: (result || undefined) as AuditResult | undefined,
            from: startOfDayIso(fromDate),
            to: invalidRange ? undefined : endOfDayIso(toDate),
        }),
        [action, result, fromDate, toDate, invalidRange],
    )
    const query = useAuditLogQuery(invalidRange ? { ...filters, from: undefined } : filters, page)

    function changeFilter(update: () => void) {
        update()
        setPage(1)
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Auditoria</h1>
            <p className={styles.subtitle}>
                Ações administrativas registradas, mais recentes primeiro. O log não pode ser editado nem apagado.
            </p>

            <div className={styles.filters}>
                <label className={styles.field}>
                    <span>Ação</span>
                    <Select
                        aria-label="Filtrar por ação"
                        value={action}
                        options={ACTION_OPTIONS}
                        onChange={(value) => changeFilter(() => setAction(value))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Resultado</span>
                    <Select
                        aria-label="Filtrar por resultado"
                        value={result}
                        options={RESULT_OPTIONS}
                        onChange={(value) => changeFilter(() => setResult(value))}
                    />
                </label>
                <label className={styles.field}>
                    <span>De</span>
                    <input
                        type="date"
                        className={styles.dateInput}
                        value={fromDate}
                        onChange={(event) => changeFilter(() => setFromDate(event.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Até</span>
                    <input
                        type="date"
                        className={styles.dateInput}
                        value={toDate}
                        onChange={(event) => changeFilter(() => setToDate(event.target.value))}
                    />
                </label>
            </div>

            {invalidRange && (
                <p className={styles.error} role="alert">
                    A data inicial é posterior à final. O filtro de período foi ignorado.
                </p>
            )}

            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o log agora. Tente novamente em instantes.
                </p>
            )}

            {query.isLoading && <p className={styles.loading}>Carregando log…</p>}

            {query.data && (
                <>
                    <p className={styles.total}>{query.data.totalEntries} registro(s)</p>
                    <AuditLogList entries={query.data.entries} />
                    <Pagination
                        page={query.data.page}
                        totalPages={query.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação do log de auditoria"
                    />
                </>
            )}
        </main>
    )
}
