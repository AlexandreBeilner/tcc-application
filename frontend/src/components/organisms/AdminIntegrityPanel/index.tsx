import { Button } from '../../atoms/Button'
import { formatDivergenceValue, INTEGRITY_KINDS, INTEGRITY_KIND_LABELS, isRunning } from '../../../features/admin/integrity'
import { formatDateTime } from '../../../features/admin/timeFormat'
import type { AdminIntegrityPanelProps } from './types'
import styles from './index.module.css'

export type { AdminIntegrityPanelProps } from './types'

// Integridade financeira (N.21): o motor reconstrói saldo e posição só dos eventos e compara com
// o que está gravado. SOMENTE LEITURA: lista as divergências e nunca oferece "corrigir" (corrigir
// é decisão humana, com a trilha de auditoria). Base consistente mostra "zero divergências".
export function AdminIntegrityPanel({ run, loading, starting, onStart }: AdminIntegrityPanelProps) {
    const running = isRunning(run)
    const report = run?.status === 'done' ? run.report : null

    return (
        <section className={styles.panel} aria-label="Integridade financeira">
            <h2 className={styles.title}>Integridade financeira</h2>
            <p className={styles.text}>
                Reconstrói o saldo e a posição de cada conta só a partir dos eventos e compara com o que está gravado, confere as cotas em
                circulação de cada ativo e procura ordens em aberto sem fundos. Só lê: nada é corrigido por aqui.
            </p>
            <div className={styles.actions}>
                <Button disabled={running || starting} onClick={onStart}>
                    {running || starting ? 'Verificando…' : 'Verificar agora'}
                </Button>
                {run && (
                    <span className={styles.meta}>
                        Última verificação: {formatDateTime(run.started_at)}
                        {run.finished_at ? '' : ' (em andamento)'}
                    </span>
                )}
            </div>

            {loading && <p className={styles.meta}>Carregando a última verificação…</p>}
            {!loading && !run && <p className={styles.meta}>Nenhuma verificação rodou desde a última subida do motor.</p>}
            {run?.status === 'failed' && (
                <p className={styles.error} role="alert">
                    A verificação falhou: {run.error ?? 'erro desconhecido'}. Tente de novo.
                </p>
            )}

            {report && (
                <>
                    <p className={report.total === 0 ? styles.ok : styles.warn} role="status">
                        {report.total === 0
                            ? 'Zero divergências: o estado bate com o histórico de eventos.'
                            : `${report.total} ${report.total === 1 ? 'divergência encontrada' : 'divergências encontradas'}.`}
                    </p>
                    <p className={styles.meta}>
                        Conferidos: {report.checked.events.toLocaleString('pt-BR')} eventos,{' '}
                        {report.checked.accounts.toLocaleString('pt-BR')} contas, {report.checked.positions.toLocaleString('pt-BR')}{' '}
                        posições, {report.checked.assets.toLocaleString('pt-BR')} ativos e{' '}
                        {report.checked.resting_orders.toLocaleString('pt-BR')} ordens em repouso.
                    </p>
                    <ul className={styles.counts} aria-label="Divergências por categoria">
                        {INTEGRITY_KINDS.map(({ kind, label, hint }) => (
                            <li key={kind} className={`${styles.count} ${report.counts[kind] > 0 ? styles.countAlert : ''}`} title={hint}>
                                <span className={styles.countValue}>{report.counts[kind]}</span>
                                <span>{label}</span>
                            </li>
                        ))}
                    </ul>
                    {report.divergences.length > 0 && (
                        <>
                            <ul className={styles.list} aria-label="Divergências encontradas">
                                {report.divergences.map((d, index) => (
                                    <li
                                        key={`${d.kind}-${d.user_id ?? ''}-${d.asset_id ?? ''}-${d.order_id ?? ''}-${index}`}
                                        className={styles.item}
                                    >
                                        <strong>{INTEGRITY_KIND_LABELS[d.kind]}</strong>
                                        <span className={styles.itemMeta}>
                                            {d.ticker ? `Ativo ${d.ticker}. ` : ''}
                                            {d.user_id ? `Conta ${d.user_id}. ` : ''}
                                            {d.order_id ? `Ordem ${d.order_id}.` : ''}
                                        </span>
                                        <span className={styles.itemValues}>
                                            Esperado: {formatDivergenceValue(d.kind, d.expected)}. Encontrado:{' '}
                                            {formatDivergenceValue(d.kind, d.found)}.{d.detail ? ` ${d.detail}.` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {report.truncated && (
                                <p className={styles.meta}>
                                    Há mais divergências do que as listadas: aparecem as primeiras 200. As contagens acima são exatas.
                                </p>
                            )}
                        </>
                    )}
                </>
            )}
        </section>
    )
}
