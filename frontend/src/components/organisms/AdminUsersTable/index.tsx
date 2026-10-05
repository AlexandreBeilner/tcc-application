import { Link } from 'react-router-dom'
import { describeProvider, isAnonymized, ROLE_LABELS, STATUS_LABELS } from '../../../features/admin/adminUsers'
import { formatDateTime } from '../../../features/admin/timeFormat'
import type { AdminUserSummary } from '../../../services/admin'
import type { AdminUsersTableProps } from './types'
import styles from './index.module.css'

export type { AdminUsersTableProps } from './types'

const providers = (user: AdminUserSummary) => (user.providers.length === 0 ? '—' : user.providers.map(describeProvider).join(', '))

// Lista de contas (N.16): tabela no tablet/desktop e cartões no mobile (nunca tabela
// com scroll horizontal em tela estreita). Estado nunca só por cor: o selo repete o
// texto e a conta suspensa ganha borda tracejada (convenção sólido/tracejado do app).
export function AdminUsersTable({ users, emptyMessage }: AdminUsersTableProps) {
    if (users.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

    const status = (user: AdminUserSummary) => (
        <span className={`${styles.badge} ${user.status === 'suspended' ? styles.dashed : ''}`}>{STATUS_LABELS[user.status]}</span>
    )
    const identity = (user: AdminUserSummary) => (
        <>
            <Link to={`/admin/usuarios/${user.id}`} className={styles.name}>
                {isAnonymized(user.username) ? 'Conta excluída' : user.name}
            </Link>
            <div className={styles.sub}>@{user.username}</div>
        </>
    )

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {['Usuário', 'E-mail', 'Papel', 'Status', 'Login por', 'Cadastro'].map((header) => (
                            <th key={header} className={styles.th}>
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className={styles.tr}>
                            <td className={styles.td}>{identity(user)}</td>
                            <td className={styles.td}>{user.email}</td>
                            <td className={styles.td}>{ROLE_LABELS[user.role]}</td>
                            <td className={styles.td}>{status(user)}</td>
                            <td className={styles.td}>{providers(user)}</td>
                            <td className={styles.td}>{formatDateTime(user.created_at)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <ul className={styles.cards}>
                {users.map((user) => (
                    <li key={user.id} className={styles.card}>
                        <div className={styles.cardHead}>{identity(user)}</div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>E-mail</span>
                            <span>{user.email}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Papel</span>
                            <span>{ROLE_LABELS[user.role]}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Status</span>
                            {status(user)}
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Login por</span>
                            <span>{providers(user)}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Cadastro</span>
                            <span>{formatDateTime(user.created_at)}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
