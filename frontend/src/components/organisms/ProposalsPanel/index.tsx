import { useState } from 'react'
import {
    useCompanyProposalsQuery,
    useProposeAgendaMutation,
    useSupportProposalMutation,
    useWithdrawSupportMutation,
} from '../../../features/assemblies/useAssemblies'
import { formatApiError } from '../../../utils/formatApiError'
import type { CompanyProposals, ProposalView } from '../../../services/assemblies'
import { Button } from '../../atoms/Button'
import { Select } from '../../atoms/Select'
import { ProInvite } from '../../molecules/ProInvite'
import styles from './index.module.css'

function blockedText(data: CompanyProposals): string | null {
    if (data.blockedReason === 'not_shareholder') return 'Para propor ou apoiar pautas desta empresa, é preciso ter ações dela.'
    if (data.blockedReason === 'company_in_cooldown') {
        const days = data.cooldownDaysLeft
        return `A empresa mudou há pouco e está em período de espera por mais ${days} ${days === 1 ? 'dia' : 'dias'} do mercado. Dá para propor depois.`
    }
    return null
}

function queueText(proposal: ProposalView, minSupport: number): string {
    if (proposal.queuePosition === 1) return 'É a próxima a ser escolhida'
    if (proposal.queuePosition !== null) return `Na fila, posição ${proposal.queuePosition}`
    const missing = Math.max(1, minSupport - proposal.supportCount)
    return `Faltam ${missing} ${missing === 1 ? 'apoio' : 'apoios'} para entrar na fila`
}

// Propostas de pauta de uma empresa (MO.6.5): quem é PRO e acionista propõe uma pauta do catálogo
// e apoia as dos outros; as mais apoiadas entram na próxima assembleia. Sem texto livre.
export function ProposalsPanel({ companyId }: { companyId: string }) {
    const query = useCompanyProposalsQuery(companyId)
    const propose = useProposeAgendaMutation(companyId)
    const support = useSupportProposalMutation()
    const withdraw = useWithdrawSupportMutation()
    const [templateKey, setTemplateKey] = useState('')

    const data = query.data
    if (!data) return null

    const blocked = blockedText(data)
    const canAct = data.isPro && data.blockedReason === null
    const options = data.availableTemplates
        .filter((template) => !template.hasActiveProposal)
        .map((template) => ({ value: template.key, label: template.title }))
    const selected = templateKey || options[0]?.value || ''
    const remaining = Math.max(0, data.limits.monthlyCap - data.limits.usedThisMonth)
    const busy = propose.isPending || support.isPending || withdraw.isPending
    const mutationError = propose.error ?? support.error ?? withdraw.error

    return (
        <section className={styles.panel} aria-labelledby="proposals-title">
            <h3 id="proposals-title" className={styles.title}>
                Propostas de pauta
            </h3>
            <p className={styles.lead}>
                Quem é PRO e tem ações da empresa propõe uma pauta do catálogo e apoia as dos outros. As mais apoiadas entram na próxima
                assembleia.
            </p>

            {blocked && <p className={styles.notice}>{blocked}</p>}

            {data.proposals.length === 0 ? (
                <p className={styles.muted}>Nenhuma proposta na fila agora.</p>
            ) : (
                <ul className={styles.list}>
                    {data.proposals.map((proposal) => (
                        <li key={proposal.id} className={styles.item}>
                            <div className={styles.itemBody}>
                                <strong className={styles.itemTitle}>{proposal.title}</strong>
                                <span className={styles.itemMeta}>
                                    {proposal.supportCount} {proposal.supportCount === 1 ? 'apoio' : 'apoios'} ·{' '}
                                    {queueText(proposal, data.limits.minSupport)}
                                </span>
                                <details className={styles.details}>
                                    <summary>Ver a pauta</summary>
                                    <p>{proposal.description}</p>
                                    <ul className={styles.optionList}>
                                        {proposal.options.map((option) => (
                                            <li key={option.label}>
                                                <strong>{option.label}</strong>: ganha {option.gain.toLowerCase()}; perde{' '}
                                                {option.loss.toLowerCase()}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            </div>
                            {proposal.supportedByMe ? (
                                <Button variant="secondary" disabled={busy} onClick={() => withdraw.mutate(proposal.id)}>
                                    Retirar meu apoio
                                </Button>
                            ) : (
                                canAct && (
                                    <Button disabled={busy} onClick={() => support.mutate(proposal.id)}>
                                        Apoiar
                                    </Button>
                                )
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {data.isPro ? (
                <div className={styles.form}>
                    <label className={styles.label} htmlFor="proposal-template">
                        Propor uma pauta
                    </label>
                    {options.length === 0 ? (
                        <p className={styles.muted}>Todas as pautas do catálogo já estão na fila.</p>
                    ) : (
                        <Select
                            id="proposal-template"
                            aria-label="Pauta do catálogo"
                            value={selected}
                            onChange={setTemplateKey}
                            options={options}
                        />
                    )}
                    <div className={styles.formRow}>
                        <Button
                            disabled={!canAct || busy || options.length === 0 || remaining === 0}
                            onClick={() => propose.mutate(selected)}
                        >
                            Propor esta pauta
                        </Button>
                        <span className={styles.muted}>
                            {remaining === 0
                                ? `Você usou as ${data.limits.monthlyCap} propostas deste mês. Elas voltam no mês que vem.`
                                : `Você tem ${remaining} de ${data.limits.monthlyCap} propostas neste mês.`}
                        </span>
                    </div>
                </div>
            ) : (
                <ProInvite context="assembly">
                    Com o PRO você propõe pautas e apoia as dos outros acionistas. Votar nas assembleias continua disponível para todo
                    mundo.
                </ProInvite>
            )}

            {mutationError && (
                <p className={styles.error} role="alert">
                    {formatApiError(mutationError, 'Não foi possível concluir agora. Tente novamente em instantes.')}
                </p>
            )}
        </section>
    )
}
