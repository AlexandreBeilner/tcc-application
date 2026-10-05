import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { describeCancelError, PHASE_LABELS, phaseOf } from '../../features/admin/macroEventLifecycle'
import { useCancelMacroEventMutation } from '../../features/admin/useCancelMacroEventMutation'
import { useMacroEventDetailQuery } from '../../features/admin/useMacroEventDetailQuery'
import { formatDateTime } from '../../features/admin/timeFormat'
import { formatSignedPercent } from '../../features/market/format'
import { formatCurrency } from '../../features/portfolio/format'
import { resolveTargets } from '../../features/news/resolveTargets'
import { useAssetLabels } from '../../features/market/useAssetLabels'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import type { NewsEventTarget } from '../../services/admin'
import { ApiError } from '../../services/client'
import styles from './index.module.css'

const WINDOW_OPTIONS = [5, 10, 30] as const

const DIRECTION_LABELS = { positivo: 'Alta', negativo: 'Baixa', misto: 'Misto' } as const
const MAGNITUDE_LABELS = { leve: 'Leve', moderado: 'Moderado', severo: 'Severo' } as const

// Tela 10.12 (N.11) — detalhe de um evento macro no painel: o que foi sorteado, quando o
// efeito começa e termina, o dia do relatório de fundamentos, a versão que o usuário vê
// hoje, o impacto realizado de preço por alvo (só depois de a janela fechar) e o botão
// de cancelar, habilitado só enquanto o evento é pendente e ainda sem efeito aplicado.
export function AdminEventoMacroDetalhe() {
    const { id } = useParams<{ id: string }>()
    const [windowDays, setWindowDays] = useState<number>(5)
    const [confirming, setConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const detailQuery = useMacroEventDetailQuery(id, windowDays)
    const cancel = useCancelMacroEventMutation()
    const assetsQuery = useAssetsQuery()
    const assetLabels = useAssetLabels(assetsQuery.data?.assets)

    const event = detailQuery.data

    function confirmCancel() {
        if (!id) return
        setError(null)
        cancel.mutate(id, {
            onError: (err) => setError(describeCancelError(err)),
            onSettled: () => setConfirming(false),
        })
    }

    function targetLabel(target: NewsEventTarget): string {
        return resolveTargets([target], assetLabels)[0]?.label ?? ''
    }

    if (detailQuery.isError) {
        const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404
        return (
            <main className={styles.page}>
                <Link to="/admin/eventos" className={styles.link}>
                    Voltar ao histórico
                </Link>
                <p className={styles.error} role="alert">
                    {notFound ? 'Esse evento não existe.' : 'Não foi possível carregar o evento agora. Tente novamente em instantes.'}
                </p>
            </main>
        )
    }

    if (!event) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando evento…</p>
            </main>
        )
    }

    const phase = phaseOf(event)
    const lastEffectDay = event.triggered_on_day + event.duration_days - 1

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>{event.title}</h1>
                    <p className={styles.subtitle}>
                        <span className={`${styles.badge} ${styles[`phase_${phase}`]}`}>{PHASE_LABELS[phase]}</span> Criado em{' '}
                        {formatDateTime(event.created_at)}
                    </p>
                </div>
                <Link to="/admin/eventos" className={styles.link}>
                    Voltar ao histórico
                </Link>
            </header>

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {cancel.isSuccess && !error && (
                <p className={styles.notice} role="status">
                    Evento cancelado. Ele não produz efeito e some do feed dos jogadores.
                </p>
            )}

            <section className={styles.panel} aria-label="Ciclo de vida">
                <h2 className={styles.sectionTitle}>Ciclo de vida</h2>
                <dl className={styles.facts}>
                    <div>
                        <dt>Dia simulado agora</dt>
                        <dd>{event.current_day}</dd>
                    </div>
                    <div>
                        <dt>{phase === 'agendado' ? 'Efeito começa no dia' : 'Efeito começou no dia'}</dt>
                        <dd>{event.triggered_on_day}</dd>
                    </div>
                    <div>
                        <dt>Duração do efeito de preço</dt>
                        <dd>
                            {event.duration_days} dia(s), até o dia {lastEffectDay}
                        </dd>
                    </div>
                    {event.fundamentals_report_day !== undefined && (
                        <div>
                            <dt>Dia do relatório de fundamentos</dt>
                            <dd>
                                {event.fundamentals_report_day}
                                {event.report_date ? ` (${event.report_date})` : ''}
                            </dd>
                        </div>
                    )}
                    <div>
                        <dt>Visível pros jogadores</dt>
                        <dd>
                            {event.publicly_visible ? 'Sim' : phase === 'cancelado' ? 'Não (cancelado)' : 'Ainda não (aparece na véspera)'}
                        </dd>
                    </div>
                </dl>
                <div className={styles.actions}>
                    <Button disabled={!event.cancellable || cancel.isPending} onClick={() => setConfirming(true)}>
                        Cancelar evento
                    </Button>
                    {!event.cancellable && (
                        <p className={styles.hint}>
                            {event.status === 'cancelado'
                                ? 'Já cancelado.'
                                : event.status === 'aplicado'
                                  ? 'Já aplicado: não dá mais pra cancelar.'
                                  : 'O efeito já começou: não dá mais pra cancelar.'}
                        </p>
                    )}
                </div>
            </section>

            <section className={styles.panel} aria-label="O que foi sorteado">
                <h2 className={styles.sectionTitle}>O que foi sorteado</h2>
                <p className={styles.narrative}>{event.narrative}</p>
                <dl className={styles.facts}>
                    <div>
                        <dt>Direção</dt>
                        <dd>{DIRECTION_LABELS[event.direction]}</dd>
                    </div>
                    <div>
                        <dt>Magnitude</dt>
                        <dd>{MAGNITUDE_LABELS[event.magnitude_band]}</dd>
                    </div>
                    {event.template_key && (
                        <div>
                            <dt>Template</dt>
                            <dd>{event.template_key}</dd>
                        </div>
                    )}
                    {event.affects_price && event.price_effect_pct !== undefined && (
                        <div>
                            <dt>Efeito de preço</dt>
                            <dd className="tabular-nums">{formatSignedPercent(event.price_effect_pct)}</dd>
                        </div>
                    )}
                    {event.affects_fundamentals && event.fundamentals_effect_pct !== undefined && (
                        <div>
                            <dt>Efeito nos fundamentos</dt>
                            <dd className="tabular-nums">{formatSignedPercent(event.fundamentals_effect_pct)}</dd>
                        </div>
                    )}
                </dl>
                <div className={styles.chips}>
                    {event.targets.map((target, index) => (
                        <span key={index} className={styles.chip}>
                            {targetLabel(target)}
                        </span>
                    ))}
                </div>
            </section>

            <section className={styles.panel} aria-label="O que o jogador vê">
                <h2 className={styles.sectionTitle}>O que o jogador vê hoje</h2>
                {!event.publicly_visible ? (
                    <p className={styles.hint}>Nada ainda: o evento não está no feed dos jogadores.</p>
                ) : (
                    <>
                        <p className={styles.narrative}>{event.user_view.narrative}</p>
                        <p className={styles.hint}>
                            {event.user_view.direction === ''
                                ? 'Enquanto o evento está pendente, o jogador não vê a direção, a magnitude, os efeitos nem os alvos. Eles aparecem depois que o evento é aplicado.'
                                : 'O evento está aplicado: o jogador já vê direção, magnitude, efeitos e alvos.'}
                        </p>
                    </>
                )}
            </section>

            <section className={styles.panel} aria-label="Impacto realizado">
                <div className={styles.impactHead}>
                    <h2 className={styles.sectionTitle}>Impacto realizado no preço</h2>
                    <label className={styles.field}>
                        <span>Janela</span>
                        <select
                            className={styles.select}
                            aria-label="Janela do impacto"
                            value={windowDays}
                            onChange={(e) => setWindowDays(Number(e.target.value))}
                        >
                            {WINDOW_OPTIONS.map((days) => (
                                <option key={days} value={days}>
                                    {days} dias
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {!event.impact.available ? (
                    <p className={styles.hint}>
                        {event.status === 'cancelado'
                            ? 'Evento cancelado: não houve efeito a medir.'
                            : !event.affects_price
                              ? 'Este evento não afeta preço.'
                              : `Disponível quando o mercado chegar ao dia ${event.impact.available_on_day} (hoje é o dia ${event.current_day}).`}
                    </p>
                ) : (
                    <>
                        <p className={styles.hint}>
                            Variação entre o dia {event.impact.base_day} (último antes do efeito) e o dia {event.impact.end_day}.
                        </p>
                        <ul className={styles.impactList}>
                            {event.impact.targets.map((target, index) => (
                                <li key={index} className={styles.impactTarget}>
                                    <div className={styles.impactTargetHead}>
                                        <strong>{targetLabel(target)}</strong>
                                        <span className="tabular-nums">
                                            {target.average_change_pct === null
                                                ? 'Sem cotação pra medir'
                                                : `Média ${formatSignedPercent(target.average_change_pct)}`}
                                        </span>
                                    </div>
                                    <ul className={styles.assetList}>
                                        {target.assets.map((asset) => (
                                            <li key={asset.asset_id} className={styles.assetRow}>
                                                <span>{asset.ticker}</span>
                                                <span className="tabular-nums">
                                                    {formatCurrency(asset.price_before)} → {formatCurrency(asset.price_after)}
                                                </span>
                                                <span className="tabular-nums">{formatSignedPercent(asset.change_pct)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>

            {confirming && (
                <ConfirmDialog
                    title="Cancelar este evento?"
                    confirmLabel="Cancelar evento"
                    pendingLabel="Cancelando…"
                    pending={cancel.isPending}
                    onConfirm={confirmCancel}
                    onCancel={() => setConfirming(false)}
                >
                    <p>
                        O evento não vai mais produzir efeito de preço nem de fundamentos e some do feed dos jogadores. Não dá pra desfazer.
                        A ação fica registrada na auditoria.
                    </p>
                </ConfirmDialog>
            )}
        </main>
    )
}
