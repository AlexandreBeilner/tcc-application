import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { TradingHaltList } from '../../components/organisms/TradingHaltList'
import {
    describeHaltError,
    haltedAssetIds,
    hasGlobalHalt,
    PAUSE_ALL_CONFIRMATION,
    REASON_MAX_LENGTH,
} from '../../features/admin/tradingHalts'
import { useLiftTradingHaltMutation, usePauseTradingMutation } from '../../features/admin/useTradingHaltActions'
import { useMarketMonitorQuery } from '../../features/admin/useMarketMonitorQuery'
import { useTradingHaltsQuery } from '../../features/admin/useTradingHaltsQuery'
import type { TradingHalt } from '../../services/admin'
import styles from './index.module.css'

type Pending = { kind: 'pause-all' } | { kind: 'pause-asset'; assetId: string; ticker: string } | { kind: 'lift'; halt: TradingHalt } | null

// Tela 10.9 (N.9) — "Pausas" do painel, dentro da seção Mercado: disjuntor de negociação
// global ou por ativo. A pausa barra ordem nova de usuário e de bot, mas NÃO para o tick
// (dia, Selic, balanços e dividendos seguem) e não cancela as ordens em repouso.
export function AdminPausas() {
    const [reason, setReason] = useState('')
    const [assetId, setAssetId] = useState('')
    const [pending, setPending] = useState<Pending>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const haltsQuery = useTradingHaltsQuery()
    const assetsQuery = useMarketMonitorQuery()
    const pause = usePauseTradingMutation()
    const lift = useLiftTradingHaltMutation()

    const active = useMemo(() => haltsQuery.data?.active ?? [], [haltsQuery.data])
    const globalHalted = hasGlobalHalt(active)
    const haltedAssets = useMemo(() => haltedAssetIds(active), [active])

    const assetOptions: SelectOption[] = useMemo(
        () => [
            { value: '', label: 'Escolha um ativo' },
            ...(assetsQuery.data ?? []).map((a) => ({
                value: a.asset_id,
                label: haltedAssets.has(a.asset_id) ? `${a.ticker} (já pausado)` : a.ticker,
            })),
        ],
        [assetsQuery.data, haltedAssets],
    )
    const selectedTicker = (assetsQuery.data ?? []).find((a) => a.asset_id === assetId)?.ticker

    const reasonReady = reason.trim().length > 0
    const canPauseAll = reasonReady && !globalHalted
    const canPauseAsset = reasonReady && assetId !== '' && !haltedAssets.has(assetId)

    function confirmPending() {
        if (!pending) return
        setNotice(null)
        setError(null)
        if (pending.kind === 'lift') {
            lift.mutate(pending.halt.id, {
                onSuccess: () =>
                    setNotice(
                        'Negociação retomada. Os bots voltam a cotar no próximo tick; para liquidez imediata, dispare 1 tick na tela de Tempo.',
                    ),
                onError: (err) => setError(describeHaltError(err)),
                onSettled: () => setPending(null),
            })
            return
        }
        const input =
            pending.kind === 'pause-all'
                ? { scope: 'global' as const, reason: reason.trim() }
                : { scope: 'asset' as const, asset_id: pending.assetId, reason: reason.trim() }
        pause.mutate(input, {
            onSuccess: () => {
                setNotice(
                    pending.kind === 'pause-all' ? 'Negociação pausada em todo o mercado.' : `Negociação de ${pending.ticker} pausada.`,
                )
                setReason('')
                setAssetId('')
            },
            onError: (err) => setError(describeHaltError(err)),
            onSettled: () => setPending(null),
        })
    }

    const confirming = pause.isPending || lift.isPending

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Pausas de negociação</h1>
                    <p className={styles.subtitle}>
                        Um disjuntor operacional. Com a pausa vigente, ordens novas de usuários e bots são recusadas; o tempo do mercado
                        segue.
                    </p>
                </div>
                <Link to="/admin/mercado" className={styles.link}>
                    Voltar ao monitor do mercado
                </Link>
            </header>

            <section className={styles.warning} aria-label="O que a pausa faz">
                <h2 className={styles.warningTitle}>Antes de pausar</h2>
                <ul className={styles.warningList}>
                    <li>
                        A pausa não suspende o tick: dia, Selic, balanços e dividendos seguem. O relógio tem o próprio interruptor na tela
                        de Tempo.
                    </li>
                    <li>Ordens em repouso permanecem, mas expiram a cada tick (regra Day) e os bots não recotam durante a pausa.</li>
                    <li>
                        Se a pausa atravessar um tick, o book fica vazio ao retomar. Retomar não força uma rodada: para liquidez imediata,
                        dispare 1 tick.
                    </li>
                </ul>
            </section>

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

            <section className={styles.panel} aria-label="Nova pausa">
                <h2 className={styles.sectionTitle}>Nova pausa</h2>
                <label className={styles.field}>
                    <span>Motivo (fica na auditoria, até {REASON_MAX_LENGTH} caracteres)</span>
                    <input
                        className={styles.input}
                        value={reason}
                        maxLength={REASON_MAX_LENGTH}
                        placeholder="Ex: volatilidade anormal em PETR4"
                        onChange={(event) => setReason(event.target.value)}
                    />
                </label>
                <div className={styles.actions}>
                    <div className={styles.assetAction}>
                        <label className={styles.field}>
                            <span>Ativo</span>
                            <Select aria-label="Ativo a pausar" value={assetId} options={assetOptions} onChange={setAssetId} />
                        </label>
                        <Button
                            variant="secondary"
                            disabled={!canPauseAsset || confirming}
                            onClick={() => selectedTicker && setPending({ kind: 'pause-asset', assetId, ticker: selectedTicker })}
                        >
                            Pausar ativo
                        </Button>
                    </div>
                    <Button disabled={!canPauseAll || confirming} onClick={() => setPending({ kind: 'pause-all' })}>
                        {globalHalted ? 'Mercado já pausado' : 'Pausar tudo'}
                    </Button>
                </div>
                {!reasonReady && <p className={styles.hint}>Escreva o motivo para habilitar os botões.</p>}
            </section>

            <section className={styles.section} aria-label="Pausas vigentes">
                <h2 className={styles.sectionTitle}>Vigentes</h2>
                {haltsQuery.isError && (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar as pausas agora. Tente novamente em instantes.
                    </p>
                )}
                {haltsQuery.isLoading && <p className={styles.loading}>Carregando pausas…</p>}
                {haltsQuery.data && (
                    <TradingHaltList
                        halts={haltsQuery.data.active}
                        onLift={(halt) => setPending({ kind: 'lift', halt })}
                        liftingId={lift.isPending ? (lift.variables ?? null) : null}
                        emptyMessage="Nenhuma pausa vigente. A negociação está aberta."
                    />
                )}
            </section>

            <section className={styles.section} aria-label="Histórico de pausas">
                <h2 className={styles.sectionTitle}>Encerradas recentemente</h2>
                {haltsQuery.data && <TradingHaltList halts={haltsQuery.data.recent} emptyMessage="Nenhuma pausa encerrada ainda." />}
            </section>

            {pending?.kind === 'pause-all' && (
                <ConfirmDialog
                    title="Pausar a negociação de todo o mercado?"
                    confirmLabel="Pausar tudo"
                    pendingLabel="Pausando…"
                    pending={confirming}
                    requireText={PAUSE_ALL_CONFIRMATION}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Todas as ordens novas, de usuários e de bots, passam a ser recusadas em todos os ativos. Afeta todos os usuários
                        agora.
                    </p>
                    <p>O tick segue. Ordens em repouso permanecem até expirar. A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'pause-asset' && (
                <ConfirmDialog
                    title={`Pausar a negociação de ${pending.ticker}?`}
                    confirmLabel="Pausar ativo"
                    pendingLabel="Pausando…"
                    pending={confirming}
                    requireText={pending.ticker}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Ordens novas de {pending.ticker}, de usuários e de bots, passam a ser recusadas. Os outros ativos seguem negociando.
                    </p>
                    <p>O tick segue. Ordens em repouso permanecem até expirar. A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'lift' && (
                <ConfirmDialog
                    title="Retomar a negociação?"
                    confirmLabel="Retomar"
                    pendingLabel="Retomando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Encerra a pausa de {pending.halt.scope === 'global' ? 'todo o mercado' : (pending.halt.ticker ?? 'um ativo')}. Os
                        bots voltam a cotar no próximo tick; retomar não força uma rodada.
                    </p>
                </ConfirmDialog>
            )}
        </main>
    )
}
