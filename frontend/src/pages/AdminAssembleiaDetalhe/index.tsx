import { Link, useParams } from 'react-router-dom'
import { ASSEMBLY_STATUS_LABELS, describeEffect, describeEffectPreview, describeOutcome } from '../../features/admin/assemblies'
import { useAdminAssemblyDetailQuery } from '../../features/admin/useAdminAssembliesQuery'
import { formatDateTime } from '../../features/admin/timeFormat'
import { ApiError } from '../../services/client'
import styles from './index.module.css'

const numberFormat = new Intl.NumberFormat('pt-BR')

// Detalhe de uma assembleia no painel (MO.6.8): quem votou em quê, com o peso (ações na data de
// corte). Exceção deliberada do administrador, como o patrimônio: o público nunca vê voto por pessoa
// (RNF09), e esta leitura não é auditada. Votos de quem não era acionista aparecem como descartados.
export function AdminAssembleiaDetalhe() {
    const { id } = useParams()
    const query = useAdminAssemblyDetailQuery(id)
    const detail = query.data

    if (query.isError) {
        const notFound = query.error instanceof ApiError && query.error.status === 404
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    {notFound
                        ? 'Essa assembleia não existe.'
                        : 'Não foi possível carregar a assembleia agora. Tente novamente em instantes.'}
                </p>
                <Link to="/admin/assembleias" className={styles.link}>
                    Voltar às assembleias
                </Link>
            </main>
        )
    }
    if (!detail) return <main className={styles.page}>{query.isLoading && <p className={styles.loading}>Carregando assembleia…</p>}</main>

    const { assembly } = detail
    const optionLabel = new Map(detail.options.map((o) => [o.id, o.label]))
    const totalWeight = detail.options.reduce((sum, o) => sum + o.weight, 0)
    const effect = describeEffect(assembly)

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        {assembly.subject_label ?? 'Empresa'}: {assembly.title ?? 'Pauta'}
                    </h1>
                    <p className={styles.subtitle}>
                        Quem votou em quê, com o peso de cada voto. Só o administrador vê isto: para os usuários o placar é por opção, em
                        porcentagem.
                    </p>
                </div>
                <Link to="/admin/assembleias" className={styles.link}>
                    Voltar às assembleias
                </Link>
            </header>

            <div className={styles.layout}>
                <div className={styles.section}>
                    <section className={styles.panel} aria-label="Resumo">
                        <h2 className={styles.sectionTitle}>Resumo</h2>
                        <dl className={styles.facts}>
                            <dt>Situação</dt>
                            <dd>
                                {ASSEMBLY_STATUS_LABELS[assembly.status]}
                                {assembly.paused ? ' (pausada)' : ''}
                            </dd>
                            <dt>Abre</dt>
                            <dd>{formatDateTime(assembly.opens_at)}</dd>
                            <dt>Fecha</dt>
                            <dd>{formatDateTime(assembly.closes_at)}</dd>
                            <dt>Efeito</dt>
                            <dd>
                                {formatDateTime(assembly.effect_applies_at)}
                                {effect ? ` (${effect.toLowerCase()})` : ''}
                            </dd>
                            <dt>Mínimo de votantes</dt>
                            <dd>{detail.min_voters}</dd>
                            <dt>Acionistas na data de corte</dt>
                            <dd>{detail.holders}</dd>
                            <dt>Votos que contam</dt>
                            <dd>
                                {detail.counted_voters} de {detail.votes.length}
                            </dd>
                            <dt>Resultado</dt>
                            <dd>{describeOutcome(assembly)}</dd>
                        </dl>
                    </section>

                    <section className={styles.panel} aria-label="Opções">
                        <h2 className={styles.sectionTitle}>Opções</h2>
                        <ul className={styles.list}>
                            {detail.options.map((option) => {
                                const percent = totalWeight > 0 ? Math.round((option.weight / totalWeight) * 1000) / 10 : 0
                                const winner = assembly.outcome === 'approved' && option.id === assembly.winning_option_id
                                return (
                                    <li key={option.id} className={styles.item}>
                                        <div className={styles.itemHead}>
                                            <span className={styles.itemTitle}>{option.label}</span>
                                            {winner && <span className={styles.badge}>Vencedora</span>}
                                        </div>
                                        <p className={styles.text}>
                                            Ganho: {option.gain} Perda: {option.loss}
                                        </p>
                                        {option.effects.map((effect) => (
                                            <p key={describeEffectPreview(effect)} className={styles.meta}>
                                                Efeito: {describeEffectPreview(effect)}
                                            </p>
                                        ))}
                                        <div className={styles.bar} role="img" aria-label={`${percent}% do peso dos votos`}>
                                            <div className={styles.barFill} style={{ width: `${percent}%` }} />
                                        </div>
                                        <p className={styles.meta}>
                                            {option.voters} votantes, {numberFormat.format(option.weight)} ações (
                                            {String(percent).replace('.', ',')}%)
                                        </p>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                </div>

                <section className={styles.section} aria-label="Votos">
                    <h2 className={styles.sectionTitle}>Votos</h2>
                    {detail.votes.length === 0 ? (
                        <p className={styles.empty}>Ninguém votou ainda.</p>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th scope="col">Pessoa</th>
                                        <th scope="col">Voto</th>
                                        <th scope="col" className={styles.num}>
                                            Ações
                                        </th>
                                        <th scope="col">Quando</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.votes.map((vote) => (
                                        <tr key={vote.user_id} className={vote.eligible ? undefined : styles.discarded}>
                                            <td>
                                                <Link to={`/admin/usuarios/${vote.user_id}`} className={styles.link}>
                                                    {vote.name ?? vote.user_id}
                                                </Link>
                                                {vote.username && <span className={styles.meta}> @{vote.username}</span>}
                                            </td>
                                            <td>{optionLabel.get(vote.option_id) ?? 'Opção desconhecida'}</td>
                                            <td className={styles.num}>
                                                {vote.weight === null ? (
                                                    <span title="Não era acionista na data de corte: o voto é descartado na apuração">
                                                        descartado
                                                    </span>
                                                ) : (
                                                    numberFormat.format(vote.weight)
                                                )}
                                            </td>
                                            <td>
                                                {formatDateTime(vote.updated_at)}
                                                {vote.updated_at !== vote.created_at ? ' (trocado)' : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
