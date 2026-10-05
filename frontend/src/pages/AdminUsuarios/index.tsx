import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { Pagination } from '../../components/molecules/Pagination'
import { AdminUsersTable } from '../../components/organisms/AdminUsersTable'
import { useAdminUsersQuery } from '../../features/admin/useAdminUsersQuery'
import type { AdminUsersQueryFilters } from '../../features/admin/useAdminUsersQuery'
import styles from './index.module.css'

const ROLE_OPTIONS: SelectOption[] = [
    { value: '', label: 'Todos os papéis' },
    { value: 'user', label: 'Usuários' },
    { value: 'admin', label: 'Administradores' },
]

const STATUS_OPTIONS: SelectOption[] = [
    { value: '', label: 'Todos os status' },
    { value: 'active', label: 'Ativas' },
    { value: 'suspended', label: 'Suspensas' },
]

const PROVIDER_OPTIONS: SelectOption[] = [
    { value: '', label: 'Qualquer login' },
    { value: 'password', label: 'E-mail e senha' },
    { value: 'google', label: 'Google' },
]

// Datas do filtro chegam como YYYY-MM-DD: o início vira 00:00 e o fim 23:59:59, no fuso
// do navegador, em ISO com offset (formato que o backend exige).
function startOfDay(date: string): string {
    return new Date(`${date}T00:00:00`).toISOString()
}

function endOfDay(date: string): string {
    return new Date(`${date}T23:59:59.999`).toISOString()
}

// Tela 10.13 (N.16) — "Usuários" do painel: busca por nome, e-mail, username ou id e
// filtros por papel, status, provedor de login e data de cadastro. Cada linha leva ao
// detalhe, onde ficam as ações (suspender, forçar logout, excluir).
export function AdminUsuarios() {
    const [text, setText] = useState('')
    const [q, setQ] = useState('')
    const [role, setRole] = useState('')
    const [status, setStatus] = useState('')
    const [provider, setProvider] = useState('')
    const [createdFrom, setCreatedFrom] = useState('')
    const [createdTo, setCreatedTo] = useState('')
    const [page, setPage] = useState(1)

    const rangeInvalid = createdFrom !== '' && createdTo !== '' && createdFrom > createdTo
    const filters = useMemo<AdminUsersQueryFilters>(
        () => ({
            q: q || undefined,
            role: (role || undefined) as AdminUsersQueryFilters['role'],
            status: (status || undefined) as AdminUsersQueryFilters['status'],
            provider: provider || undefined,
            created_from: createdFrom && !rangeInvalid ? startOfDay(createdFrom) : undefined,
            created_to: createdTo && !rangeInvalid ? endOfDay(createdTo) : undefined,
        }),
        [q, role, status, provider, createdFrom, createdTo, rangeInvalid],
    )

    const usersQuery = useAdminUsersQuery(filters, page)

    function changeFilter(update: () => void) {
        update()
        setPage(1)
    }

    function submitSearch(event: FormEvent) {
        event.preventDefault()
        changeFilter(() => setQ(text.trim()))
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Usuários</h1>
                    <p className={styles.subtitle}>
                        Contas da plataforma. Abra uma conta para ver patrimônio, progressão e ordens, suspender, encerrar sessões ou
                        excluir a pedido (LGPD).
                    </p>
                </div>
            </header>

            <form className={styles.filters} onSubmit={submitSearch} role="search">
                <label className={styles.field}>
                    <span>Buscar por nome, e-mail, username ou id</span>
                    <input
                        className={styles.input}
                        value={text}
                        placeholder="Ex: maria, @maria, id completo"
                        onChange={(event) => setText(event.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    <span>Papel</span>
                    <Select
                        aria-label="Filtrar por papel"
                        value={role}
                        options={ROLE_OPTIONS}
                        onChange={(v) => changeFilter(() => setRole(v))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Status</span>
                    <Select
                        aria-label="Filtrar por status"
                        value={status}
                        options={STATUS_OPTIONS}
                        onChange={(v) => changeFilter(() => setStatus(v))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Login por</span>
                    <Select
                        aria-label="Filtrar por provedor de login"
                        value={provider}
                        options={PROVIDER_OPTIONS}
                        onChange={(v) => changeFilter(() => setProvider(v))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Cadastro a partir de</span>
                    <input
                        type="date"
                        className={styles.input}
                        value={createdFrom}
                        onChange={(event) => changeFilter(() => setCreatedFrom(event.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Cadastro até</span>
                    <input
                        type="date"
                        className={styles.input}
                        value={createdTo}
                        aria-invalid={rangeInvalid}
                        onChange={(event) => changeFilter(() => setCreatedTo(event.target.value))}
                    />
                </label>
                <div className={styles.toolbar}>
                    <button type="submit" className={styles.actionButton}>
                        Buscar
                    </button>
                </div>
            </form>
            {rangeInvalid && (
                <p className={styles.error} role="alert">
                    A data inicial precisa ser anterior ou igual à final. O filtro de datas foi ignorado.
                </p>
            )}

            {usersQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar os usuários agora. Tente novamente em instantes.
                </p>
            )}
            {usersQuery.isLoading && <p className={styles.loading}>Carregando usuários…</p>}

            {usersQuery.data && (
                <>
                    <p className={styles.total}>{usersQuery.data.total} conta(s)</p>
                    <AdminUsersTable users={usersQuery.data.users} emptyMessage="Nenhuma conta com esse filtro." />
                    <Pagination
                        page={usersQuery.data.page}
                        totalPages={usersQuery.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação dos usuários"
                    />
                </>
            )}
        </main>
    )
}
