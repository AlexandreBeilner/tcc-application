import { Link, useParams } from 'react-router-dom'
import { AssemblyOptionCard } from '../../components/molecules/AssemblyOptionCard'
import { ProInvite } from '../../components/molecules/ProInvite'
import { closesLabel, formatShortDate, isCreditShortage, outcomeBadge, resultHeadline } from '../../features/assemblies/assemblyText'
import { isFeatureOff, useAssemblyQuery, useCastVoteMutation, useMyVotingStatusQuery } from '../../features/assemblies/useAssemblies'
import { formatApiError } from '../../utils/formatApiError'
import styles from './index.module.css'

// Detalhe da assembleia (MO.6.6): ficha da pauta com as duas opções (ganho, perda e o que ela
// mexe, sem recomendar lado), placar ao vivo por polling, voto e resultado. Quem não pode votar
// vê o motivo em texto sem culpa e, só se faltar crédito, o convite ao PRO. No desktop a ficha
// ocupa a coluna larga e a situação da pessoa fica fixa ao lado.
export function AssembleiaDetalhe() {
    const { id = '' } = useParams<{ id: string }>()
    const query = useAssemblyQuery(id)
    const detail = query.data
    const isOpen = detail?.assembly.status === 'open'
    const me = useMyVotingStatusQuery(id, Boolean(isOpen))
    const vote = useCastVoteMutation(id)

    if (query.isError) {
        const missing = isFeatureOff(query.error)
        return (
            <main className={styles.page}>
                <Link to="/assembleias" className={styles.back}>
                    Todas as assembleias
                </Link>
                <p className={styles.error} role="alert">
                    {missing
                        ? 'Esta assembleia não foi encontrada.'
                        : 'Não foi possível carregar esta assembleia agora. Tente novamente em instantes.'}
                </p>
            </main>
        )
    }
    if (!detail) {
        return (
            <main className={styles.page}>
                <p className={styles.muted}>Carregando assembleia…</p>
            </main>
        )
    }

    const { assembly, options, scoreboard, result } = detail
    const headline = resultHeadline(detail)
    const status = me.data
    const canVote = Boolean(isOpen && status?.canVote)
    const myOptionId = status?.myVote?.optionId ?? null

    return (
        <main className={styles.page}>
            <Link to="/assembleias" className={styles.back}>
                Todas as assembleias
            </Link>
            <header className={styles.header}>
                <p className={styles.company}>
                    <Link to={`/mercado/empresas/${assembly.subjectRef}`}>{assembly.subjectLabel ?? 'Empresa'}</Link>
                </p>
                <h1 className={styles.title}>{assembly.title ?? 'Assembleia de acionistas'}</h1>
                <p className={styles.meta}>
                    <span className={styles.badge}>{outcomeBadge(assembly)}</span>
                    <span>{isOpen ? closesLabel(assembly.closesAt) : `Encerrada em ${formatShortDate(assembly.closesAt)}`}</span>
                </p>
                {assembly.description && <p className={styles.description}>{assembly.description}</p>}
            </header>

            <div className={styles.layout}>
                <div className={styles.main}>
                    {headline && (
                        <section className={styles.result} aria-label="Resultado">
                            <h2 className={styles.resultTitle}>{headline}</h2>
                            <p className={styles.muted}>
                                {result?.voterCount} {result?.voterCount === 1 ? 'pessoa votou' : 'pessoas votaram'}.{' '}
                                {result?.outcome === 'approved'
                                    ? assembly.effectAppliedAt
                                        ? 'O efeito já está em andamento na empresa, aos poucos.'
                                        : `O efeito começa em ${formatShortDate(assembly.effectAppliesAt)} e age aos poucos.`
                                    : 'Por isso a empresa segue como estava.'}
                            </p>
                        </section>
                    )}

                    <section className={styles.options} aria-label="Opções da pauta">
                        {options.map((option) => (
                            <AssemblyOptionCard
                                key={option.id}
                                option={option}
                                score={scoreboard.options.find((s) => s.optionId === option.id)}
                                mine={myOptionId === option.id}
                                winner={result?.outcome === 'approved' && result.winningOptionId === option.id}
                                canVote={canVote}
                                pending={vote.isPending}
                                hasVoted={myOptionId !== null}
                                onVote={(optionId) => vote.mutate(optionId)}
                            />
                        ))}
                    </section>

                    <p className={styles.muted}>
                        {scoreboard.voters} {scoreboard.voters === 1 ? 'votante' : 'votantes'} até agora. A porcentagem é das ações de quem
                        votou.
                        {isOpen && ' O placar se atualiza sozinho.'}
                    </p>
                </div>

                {isOpen && (
                    <aside className={styles.side} aria-label="Sua situação">
                        <h2 className={styles.sideTitle}>Sua situação</h2>
                        {me.isLoading && <p className={styles.muted}>Conferindo seu direito de voto…</p>}
                        {status && (
                            <>
                                {status.myShares !== null && status.myShares > 0 && (
                                    <p className={styles.sideText}>
                                        Você tinha {status.myShares} {status.myShares === 1 ? 'ação' : 'ações'} da empresa na abertura. Seu
                                        voto pesa em proporção a elas.
                                    </p>
                                )}
                                {status.myVote ? (
                                    <p className={styles.sideText}>Seu voto está registrado. Dá para trocar até a votação fechar.</p>
                                ) : (
                                    canVote && <p className={styles.sideText}>Escolha uma das opções para votar.</p>
                                )}
                                {!status.canVote && status.message && <p className={styles.notice}>{status.message}</p>}
                                {!status.isPro && status.canVote && !status.myVote && (
                                    <p className={styles.sideText}>
                                        Seu voto gratuito do mês: {status.credit.available} de {status.credit.limit} disponível.
                                    </p>
                                )}
                                {isCreditShortage(status.reason) && (
                                    <ProInvite context="assembly">
                                        O PRO vota em todas as assembleias, sem depender do voto gratuito do mês. O voto gratuito volta no
                                        mês que vem.
                                    </ProInvite>
                                )}
                            </>
                        )}
                        {vote.isError && (
                            <p className={styles.error} role="alert">
                                {formatApiError(vote.error, 'Não foi possível registrar o voto agora. Tente novamente em instantes.')}
                            </p>
                        )}
                        {vote.isSuccess && !vote.isPending && <p className={styles.success}>Voto registrado.</p>}
                    </aside>
                )}
            </div>
        </main>
    )
}
