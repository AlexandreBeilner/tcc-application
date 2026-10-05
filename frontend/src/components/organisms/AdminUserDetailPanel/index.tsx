import { Link } from 'react-router-dom'
import { describeOwner, STATUS_LABELS as ORDER_STATUS_LABELS } from '../../../features/admin/adminOrders'
import { describeProvider, isAnonymized, ROLE_LABELS, STATUS_LABELS } from '../../../features/admin/adminUsers'
import { AUDIT_ACTION_LABELS, AUDIT_RESULT_LABELS } from '../../../features/admin/auditLabels'
import { formatDateTime } from '../../../features/admin/timeFormat'
import { formatCurrency } from '../../../features/portfolio/format'
import type { AdminUserDetailPanelProps } from './types'
import styles from './index.module.css'

export type { AdminUserDetailPanelProps } from './types'

const integerFormatter = new Intl.NumberFormat('pt-BR')

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className={styles.row}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{children}</dd>
        </div>
    )
}

// Detalhe de uma conta (N.16): quatro cartões de leitura (conta, progressão, carteira,
// ordens abertas) e a linha do tempo de ações do painel sobre ela. O patrimônio
// absoluto aparece de propósito: a regra de privacidade vale entre usuários, não para
// o administrador (CLAUDE.md). Conta suspensa traz o motivo e usa borda tracejada.
export function AdminUserDetailPanel({ detail }: AdminUserDetailPanelProps) {
    const { account, progression, portfolio, open_orders: openOrders, timeline } = detail
    const suspended = account.status === 'suspended'

    return (
        <div className={styles.grid}>
            <section className={`${styles.card} ${suspended ? styles.dashed : ''}`} aria-labelledby="user-account">
                <h2 id="user-account" className={styles.cardTitle}>
                    Conta
                </h2>
                <dl className={styles.list}>
                    <Row label="Nome">{isAnonymized(account.username) ? 'Conta excluída' : account.name}</Row>
                    <Row label="Username">@{account.username}</Row>
                    <Row label="E-mail">{account.email}</Row>
                    <Row label="Papel">{ROLE_LABELS[account.role]}</Row>
                    <Row label="Status">
                        <span className={`${styles.badge} ${suspended ? styles.dashed : ''}`}>{STATUS_LABELS[account.status]}</span>
                    </Row>
                    {suspended && (
                        <>
                            <Row label="Motivo da suspensão">{account.suspended_reason ?? 'Não informado'}</Row>
                            <Row label="Suspensa em">{formatDateTime(account.suspended_at)}</Row>
                        </>
                    )}
                    <Row label="Login por">
                        {account.providers.length === 0 ? 'Nenhum' : account.providers.map(describeProvider).join(', ')}
                    </Row>
                    <Row label="Onboarding">{account.onboarding_completed ? 'Concluído' : 'Pendente'}</Row>
                    <Row label="Cadastro">{formatDateTime(account.created_at)}</Row>
                </dl>
            </section>

            <section className={styles.card} aria-labelledby="user-progress">
                <h2 id="user-progress" className={styles.cardTitle}>
                    Progressão
                </h2>
                <dl className={styles.list}>
                    <Row label="Nível">{progression.level}</Row>
                    <Row label="XP">{integerFormatter.format(progression.xp)}</Row>
                    <Row label="Sequência atual">{progression.current_streak} dia(s)</Row>
                    <Row label="Maior sequência">{progression.longest_streak} dia(s)</Row>
                    <Row label="Última atividade">{progression.last_qualifying_activity_date ?? '—'}</Row>
                    <Row label="Conquistas">{detail.achievements_count}</Row>
                    <Row label="Amigos">{detail.friends_count}</Row>
                </dl>
            </section>

            <section className={styles.card} aria-labelledby="user-portfolio">
                <h2 id="user-portfolio" className={styles.cardTitle}>
                    Carteira
                </h2>
                {portfolio === null ? (
                    <p className={styles.muted}>Carteira indisponível: o motor não respondeu ou a conta não tem carteira.</p>
                ) : (
                    <>
                        <dl className={styles.list}>
                            <Row label="Patrimônio total">
                                <strong className="tabular-nums">{formatCurrency(portfolio.net_worth)}</strong>
                            </Row>
                            <Row label="Caixa">
                                <span className="tabular-nums">{formatCurrency(portfolio.cash)}</span>
                            </Row>
                            <Row label="Renda variável">
                                <span className="tabular-nums">{formatCurrency(portfolio.variable_income_value)}</span>
                            </Row>
                            <Row label="Renda fixa">
                                <span className="tabular-nums">{formatCurrency(portfolio.fixed_income_value)}</span>
                            </Row>
                        </dl>
                        {portfolio.positions.length === 0 ? (
                            <p className={styles.muted}>Sem posições.</p>
                        ) : (
                            <ul className={styles.items}>
                                {portfolio.positions.map((position) => (
                                    <li key={`${position.asset_id}-${position.is_sandbox}`} className={styles.item}>
                                        <span>
                                            <strong>{position.ticker}</strong>
                                            {position.is_sandbox && <span className={styles.sub}> (sandbox)</span>}
                                        </span>
                                        <span className={`${styles.sub} tabular-nums`}>
                                            {integerFormatter.format(position.quantity)} a {formatCurrency(position.average_price)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </section>

            <section className={styles.card} aria-labelledby="user-orders">
                <h2 id="user-orders" className={styles.cardTitle}>
                    Ordens abertas
                </h2>
                {openOrders === null ? (
                    <p className={styles.muted}>Ordens indisponíveis: o motor não respondeu.</p>
                ) : openOrders.total === 0 ? (
                    <p className={styles.muted}>Nenhuma ordem em repouso.</p>
                ) : (
                    <>
                        <ul className={styles.items}>
                            {openOrders.orders.map((order) => (
                                <li key={order.order_id} className={styles.item}>
                                    <span>
                                        {order.side === 'buy' ? 'Compra' : 'Venda'} de {order.quantity - order.filled_quantity}{' '}
                                        <strong>{order.ticker}</strong>
                                    </span>
                                    <span className={`${styles.sub} tabular-nums`}>
                                        {formatCurrency(order.price)}, {ORDER_STATUS_LABELS[order.status]}, {describeOwner(order)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className={styles.sub}>
                            {openOrders.total} ordem(ns) aberta(s).{' '}
                            <Link to={`/admin/mercado/ordens?user_id=${account.id}`} className={styles.link}>
                                Ver e cancelar na tela de Ordens
                            </Link>
                        </p>
                    </>
                )}
            </section>

            <section className={`${styles.card} ${styles.wide}`} aria-labelledby="user-timeline">
                <h2 id="user-timeline" className={styles.cardTitle}>
                    Linha do tempo no painel
                </h2>
                {timeline.length === 0 ? (
                    <p className={styles.muted}>Nenhuma ação do painel sobre esta conta.</p>
                ) : (
                    <ul className={styles.items}>
                        {timeline.map((entry) => {
                            const reason = typeof entry.payload.reason === 'string' ? entry.payload.reason : null
                            return (
                                <li key={entry.id} className={styles.item}>
                                    <span>
                                        <span className={`${styles.badge} ${entry.result === 'failed' ? styles.dashed : ''}`}>
                                            {AUDIT_RESULT_LABELS[entry.result]}
                                        </span>{' '}
                                        {AUDIT_ACTION_LABELS[entry.action]}
                                        {reason && <span className={styles.sub}>: {reason}</span>}
                                        {entry.result === 'failed' && entry.error_message && (
                                            <span className={styles.sub}> ({entry.error_message})</span>
                                        )}
                                    </span>
                                    <span className={styles.sub}>
                                        {entry.admin_username ?? 'admin removido'}, {formatDateTime(entry.occurred_at)}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </div>
    )
}
