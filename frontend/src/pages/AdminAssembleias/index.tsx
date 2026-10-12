import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import {
    ASSEMBLY_STATUS_LABELS,
    companyOptions,
    describeAssemblyError,
    describeEffect,
    describeOutcome,
    hasGlobalPause,
    pausedCompanyIds,
    pauseScopeLabel,
    PAUSE_ALL_CONFIRMATION,
    REASON_MAX_LENGTH,
} from '../../features/admin/assemblies'
import { useAdminAssembliesQuery } from '../../features/admin/useAdminAssembliesQuery'
import { useAdminCatalogQuery } from '../../features/admin/useAdminCatalogQuery'
import { useLiftAssemblyPauseMutation, useAssemblyPausesQuery, usePauseAssembliesMutation } from '../../features/admin/useAssemblyPauses'
import { formatDateTime } from '../../features/admin/timeFormat'
import type { AdminAssemblyStatus, AssemblyPause } from '../../services/admin'
import styles from './index.module.css'

type Pending =
    { kind: 'pause-all' } | { kind: 'pause-company'; companyId: string; name: string } | { kind: 'lift'; pause: AssemblyPause } | null

const STATUS_FILTER: SelectOption[] = [
    { value: '', label: 'Todas' },
    { value: 'scheduled', label: ASSEMBLY_STATUS_LABELS.scheduled },
    { value: 'open', label: ASSEMBLY_STATUS_LABELS.open },
    { value: 'closed', label: ASSEMBLY_STATUS_LABELS.closed },
]

// Tela das assembleias do painel (MO.6.8): as assembleias de todos os estados, com a marca de efeito
// pendente, e a pausa do ciclo (global ou por empresa). A pausa só impede abrir assembleia nova e
// aplicar efeito: fechar e apurar seguem (o prazo de voto é uma promessa a quem vota) e nada se perde.
export function AdminAssembleias() {
    const [status, setStatus] = useState<AdminAssemblyStatus | ''>('')
    const [reason, setReason] = useState('')
    const [companyId, setCompanyId] = useState('')
    const [pending, setPending] = useState<Pending>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const assembliesQuery = useAdminAssembliesQuery(status || undefined)
    const pausesQuery = useAssemblyPausesQuery()
    const catalogQuery = useAdminCatalogQuery()
    const pause = usePauseAssembliesMutation()
    const lift = useLiftAssemblyPauseMutation()

    const companies = useMemo(() => companyOptions(catalogQuery.data), [catalogQuery.data])
    const companyNames = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies])
    const active = useMemo(() => pausesQuery.data?.active ?? [], [pausesQuery.data])
    const globalPaused = hasGlobalPause(active)
    const pausedCompanies = useMemo(() => pausedCompanyIds(active), [active])

    const companySelect: SelectOption[] = useMemo(
        () => [
            { value: '', label: 'Escolha uma empresa' },
            ...companies.map((c) => ({ value: c.id, label: pausedCompanies.has(c.id) ? `${c.name} (já pausada)` : c.name })),
        ],
        [companies, pausedCompanies],
    )

    const reasonReady = reason.trim().length >= 3
    const canPauseAll = reasonReady && !globalPaused
    const canPauseCompany = reasonReady && companyId !== '' && !pausedCompanies.has(companyId)
    const confirming = pause.isPending || lift.isPending

    function confirmPending() {
        if (!pending) return
        setNotice(null)
        setError(null)
        if (pending.kind === 'lift') {
            lift.mutate(pending.pause.id, {
                onSuccess: () =>
                    setNotice('Assembleias retomadas. O ciclo abre e aplica o que ficou esperando na próxima rodada (de hora em hora).'),
                onError: (err) => setError(describeAssemblyError(err)),
                onSettled: () => setPending(null),
            })
            return
        }
        const input =
            pending.kind === 'pause-all'
                ? { scope: 'global' as const, reason: reason.trim() }
                : { scope: 'company' as const, company_id: pending.companyId, reason: reason.trim() }
        pause.mutate(input, {
            onSuccess: () => {
                setNotice(pending.kind === 'pause-all' ? 'Todas as assembleias pausadas.' : `Assembleias de ${pending.name} pausadas.`)
                setReason('')
                setCompanyId('')
            },
            onError: (err) => setError(describeAssemblyError(err)),
            onSettled: () => setPending(null),
        })
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Assembleias de acionistas</h1>
                    <p className={styles.subtitle}>
                        Acompanhe as assembleias, os votos e o efeito, e pause o ciclo quando precisar. Parâmetros e pautas podem ser
                        ajustados mesmo com as assembleias desligadas para os usuários (ASSEMBLIES_ENABLED=off).
                    </p>
                </div>
                <nav className={styles.links} aria-label="Ajustes das assembleias">
                    <Link to="/admin/assembleias/parametros" className={styles.link}>
                        Parâmetros
                    </Link>
                    <Link to="/admin/assembleias/pautas" className={styles.link}>
                        Catálogo de pautas
                    </Link>
                </nav>
            </header>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            <div className={styles.layout}>
                <section className={styles.section} aria-label="Assembleias">
                    <div className={styles.filters}>
                        <h2 className={styles.sectionTitle}>Assembleias</h2>
                        <label className={styles.field}>
                            <span>Situação</span>
                            <Select
                                aria-label="Filtrar por situação"
                                value={status}
                                options={STATUS_FILTER}
                                onChange={(value) => setStatus(value as AdminAssemblyStatus | '')}
                            />
                        </label>
                    </div>
                    {assembliesQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar as assembleias agora. Tente novamente em instantes.
                        </p>
                    )}
                    {assembliesQuery.isLoading && <p className={styles.loading}>Carregando assembleias…</p>}
                    {assembliesQuery.data && assembliesQuery.data.length === 0 && (
                        <p className={styles.empty}>Nenhuma assembleia por aqui ainda.</p>
                    )}
                    {assembliesQuery.data && assembliesQuery.data.length > 0 && (
                        <ul className={styles.list}>
                            {assembliesQuery.data.map((assembly) => {
                                const effect = describeEffect(assembly)
                                return (
                                    <li key={assembly.id} className={styles.item}>
                                        <div className={styles.row}>
                                            <div>
                                                <div className={styles.itemHead}>
                                                    <span
                                                        className={`${styles.badge} ${assembly.status === 'closed' ? styles.dashed : ''}`}
                                                    >
                                                        {ASSEMBLY_STATUS_LABELS[assembly.status]}
                                                    </span>
                                                    {assembly.paused && <span className={`${styles.badge} ${styles.dashed}`}>Pausada</span>}
                                                    {assembly.dividend_on_hold && (
                                                        <span className={`${styles.badge} ${styles.dashed}`}>Dividendo retido</span>
                                                    )}
                                                    {effect && <span className={`${styles.badge} ${styles.dashed}`}>{effect}</span>}
                                                </div>
                                                <p className={styles.itemTitle}>
                                                    {assembly.subject_label ?? 'Empresa'}: {assembly.title ?? 'Pauta'}
                                                </p>
                                            </div>
                                            <Link to={`/admin/assembleias/${assembly.id}`} className={styles.small}>
                                                Ver votos
                                            </Link>
                                        </div>
                                        <div className={styles.facts}>
                                            <span>Abre: {formatDateTime(assembly.opens_at)}</span>
                                            <span>Fecha: {formatDateTime(assembly.closes_at)}</span>
                                            <span>Efeito: {formatDateTime(assembly.effect_applies_at)}</span>
                                            <span>Mínimo: {assembly.min_voters ?? 'valor de agora'}</span>
                                            <span>Votantes: {assembly.voter_count ?? '—'}</span>
                                            {assembly.status === 'closed' && <span>{describeOutcome(assembly)}</span>}
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>

                <aside className={styles.side} aria-label="Pausa do ciclo">
                    <section className={styles.warning} aria-label="O que a pausa faz">
                        <h2 className={styles.warningTitle}>O que a pausa faz</h2>
                        <ul className={styles.warningList}>
                            <li>Impede abrir assembleia nova e aplicar efeito no mundo.</li>
                            <li>Fechar e apurar seguem: o prazo de voto é uma promessa a quem vota, e votar continua liberado.</li>
                            <li>Nada se perde: o que ficou esperando acontece na rodada seguinte à retomada.</li>
                            <li>Um balanço que passar da janela de recuperação durante a pausa não abre assembleia depois.</li>
                        </ul>
                    </section>

                    <section className={styles.panel} aria-label="Nova pausa">
                        <h2 className={styles.sectionTitle}>Nova pausa</h2>
                        <label className={styles.field}>
                            <span>Motivo (fica na auditoria, até {REASON_MAX_LENGTH} caracteres)</span>
                            <input
                                className={styles.input}
                                value={reason}
                                maxLength={REASON_MAX_LENGTH}
                                placeholder="Ex: revisão das pautas de um setor"
                                onChange={(event) => setReason(event.target.value)}
                            />
                        </label>
                        <label className={styles.field}>
                            <span>Empresa</span>
                            <Select aria-label="Empresa a pausar" value={companyId} options={companySelect} onChange={setCompanyId} />
                        </label>
                        <div className={styles.actions}>
                            <Button
                                variant="secondary"
                                disabled={!canPauseCompany || confirming}
                                onClick={() => {
                                    const name = companyNames.get(companyId)
                                    if (name) setPending({ kind: 'pause-company', companyId, name })
                                }}
                            >
                                Pausar empresa
                            </Button>
                            <Button disabled={!canPauseAll || confirming} onClick={() => setPending({ kind: 'pause-all' })}>
                                {globalPaused ? 'Já pausadas' : 'Pausar todas'}
                            </Button>
                        </div>
                        {!reasonReady && <p className={styles.hint}>Escreva o motivo (3 caracteres ou mais) para habilitar os botões.</p>}
                    </section>

                    <section className={styles.section} aria-label="Pausas vigentes">
                        <h2 className={styles.sectionTitle}>Vigentes</h2>
                        {pausesQuery.isError && (
                            <p className={styles.error} role="alert">
                                Não foi possível carregar as pausas agora.
                            </p>
                        )}
                        {pausesQuery.data && active.length === 0 && (
                            <p className={styles.empty}>Nenhuma pausa vigente. O ciclo está andando.</p>
                        )}
                        {active.length > 0 && (
                            <ul className={styles.list}>
                                {active.map((item) => (
                                    <li key={item.id} className={styles.item}>
                                        <div className={styles.itemHead}>
                                            <span className={styles.badge}>Vigente</span>
                                            <span className={styles.itemTitle}>{pauseScopeLabel(item, companyNames)}</span>
                                            <button
                                                type="button"
                                                className={styles.small}
                                                disabled={confirming}
                                                onClick={() => setPending({ kind: 'lift', pause: item })}
                                            >
                                                Retomar
                                            </button>
                                        </div>
                                        <p className={styles.text}>Motivo: {item.reason}</p>
                                        <p className={styles.meta}>Desde {formatDateTime(item.created_at)}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {pausesQuery.data && pausesQuery.data.recent.length > 0 && (
                            <>
                                <h3 className={styles.sectionTitle}>Encerradas recentemente</h3>
                                <ul className={styles.list}>
                                    {pausesQuery.data.recent.map((item) => (
                                        <li key={item.id} className={styles.item}>
                                            <div className={styles.itemHead}>
                                                <span className={`${styles.badge} ${styles.dashed}`}>Encerrada</span>
                                                <span className={styles.itemTitle}>{pauseScopeLabel(item, companyNames)}</span>
                                            </div>
                                            <p className={styles.text}>Motivo: {item.reason}</p>
                                            <p className={styles.meta}>
                                                {formatDateTime(item.created_at)} até {formatDateTime(item.lifted_at)}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </section>
                </aside>
            </div>

            {pending?.kind === 'pause-all' && (
                <ConfirmDialog
                    title="Pausar todas as assembleias?"
                    confirmLabel="Pausar todas"
                    pendingLabel="Pausando…"
                    pending={confirming}
                    requireText={PAUSE_ALL_CONFIRMATION}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>Nenhuma assembleia nova abre e nenhum efeito é aplicado enquanto durar. Votar e fechar seguem normalmente.</p>
                    <p>A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'pause-company' && (
                <ConfirmDialog
                    title={`Pausar as assembleias de ${pending.name}?`}
                    confirmLabel="Pausar empresa"
                    pendingLabel="Pausando…"
                    pending={confirming}
                    requireText={pending.name}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Nenhuma assembleia nova de {pending.name} abre e o efeito de uma aprovada fica esperando. As demais empresas seguem.
                    </p>
                    <p>A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'lift' && (
                <ConfirmDialog
                    title="Retomar as assembleias?"
                    confirmLabel="Retomar"
                    pendingLabel="Retomando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Encerra a pausa de {pauseScopeLabel(pending.pause, companyNames).toLowerCase()}. O que ficou esperando acontece na
                        próxima rodada do ciclo.
                    </p>
                </ConfirmDialog>
            )}
        </main>
    )
}
