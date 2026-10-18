import { StatCard, StatFact } from '../../components/molecules/StatCard'
import { SystemHealthStrip } from '../../components/organisms/SystemHealthStrip'
import { useAdminOverviewQuery } from '../../features/admin/useAdminOverviewQuery'
import { useSystemHealthQuery } from '../../features/admin/useSystemHealthQuery'
import { formatDateTime, formatDuration } from '../../features/admin/timeFormat'
import { formatCurrency } from '../../features/portfolio/format'
import type { AdminOverview, SchedulerStatus, TickRun, TickTrigger } from '../../services/admin'
import styles from './index.module.css'

const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Selic e IPCA chegam em pontos percentuais (ex: 10.75 = 10,75%).
function formatPercentPoints(value: number | null): string {
    return value === null ? '—' : `${percentFormatter.format(value)}%`
}

const TRIGGER_LABELS: Record<TickTrigger, string> = {
    scheduled: 'agendado',
    catchup: 'recuperação',
    manual: 'manual',
}

function schedulerState(scheduler: SchedulerStatus): string {
    if (!scheduler.enabled) return 'Desligada neste ambiente'
    return scheduler.paused ? 'Pausada' : 'Ativa'
}

function describeLastTick(tick: TickRun): string {
    const day = tick.simulated_day === null ? 'sem dia' : `dia ${tick.simulated_day}`
    const outcome = tick.status === 'failed' ? `falhou (${tick.error_message ?? 'sem detalhe'})` : formatDuration(tick.duration_ms)
    return `${formatDateTime(tick.started_at)}, ${day}, ${TRIGGER_LABELS[tick.trigger]}, ${outcome}`
}

function MarketCard({ overview }: { overview: AdminOverview }) {
    const { market, errors } = overview
    if (!market) return <StatCard title="Mercado" unavailable={errors.market ?? 'sem resposta do motor'} />
    return (
        <StatCard title="Mercado" to="/admin/eventos" linkLabel="Eventos macro">
            <StatFact label="Dia simulado" value={String(market.simulated_day)} />
            <StatFact label="Selic" value={formatPercentPoints(market.selic_rate)} />
            <StatFact label="IPCA no mês" value={formatPercentPoints(market.ipca_monthly)} />
            <StatFact label="IPCA em 12 meses" value={formatPercentPoints(market.ipca_accumulated_12m)} />
            <StatFact label="Eventos macro pendentes" value={String(market.pending_macro_events)} />
            <StatFact label="Ativos sem Market Maker" value={`${market.uncovered_assets} de ${market.tradable_assets}`} />
        </StatCard>
    )
}

function TimeCard({ overview }: { overview: AdminOverview }) {
    const { scheduler, last_tick, errors } = overview
    if (!scheduler) return <StatCard title="Tempo" unavailable={errors.scheduler ?? 'sem resposta do motor'} />
    return (
        <StatCard title="Tempo" to="/admin/tempo" linkLabel="Controlar o tempo">
            <StatFact label="Agenda" value={schedulerState(scheduler)} />
            <StatFact label="Próximo tick" value={scheduler.paused ? 'Pausado' : formatDateTime(scheduler.next_slot_at)} />
            <StatFact label="Ritmo" value={`${scheduler.ticks_per_day} ticks por dia real`} />
            <StatFact label="Tick em andamento" value={scheduler.tick_in_progress ? 'Sim' : 'Não'} />
            <StatFact
                label="Último tick"
                value={last_tick ? describeLastTick(last_tick) : (errors.last_tick ?? 'Nenhum tick registrado ainda')}
            />
        </StatCard>
    )
}

function TradingCard({ overview }: { overview: AdminOverview }) {
    const { market, errors } = overview
    if (!market) return <StatCard title="Negociação" unavailable={errors.market ?? 'sem resposta do motor'} />
    return (
        <StatCard title="Negociação">
            <StatFact label="Negócios no dia simulado" value={String(market.day_trades)} />
            <StatFact label="Volume no dia simulado" value={formatCurrency(market.day_volume)} />
            <StatFact label="Ordens abertas no book" value={String(market.resting_orders)} />
            <StatFact label="Bots ativos" value={`${market.active_bots} de ${market.total_bots}`} />
        </StatCard>
    )
}

function UsersCard({ overview }: { overview: AdminOverview }) {
    const { users, errors } = overview
    if (!users) return <StatCard title="Usuários" unavailable={errors.users ?? 'sem resposta do banco'} />
    return (
        <StatCard title="Usuários">
            <StatFact label="Total" value={String(users.total)} />
            <StatFact label="Cadastros em 24 h" value={String(users.signups_last_24h)} />
            <StatFact label="Cadastros em 7 dias" value={String(users.signups_last_7d)} />
        </StatCard>
    )
}

function RetentionCard() {
    return (
        <StatCard title="Retenção" to="/admin/retencao" linkLabel="Abrir painel">
            <StatFact
                label="O que mostra"
                value="Quem volta nos dias 1, 7 e 30, DAU/MAU e o tempo até a primeira lição e a primeira operação"
            />
        </StatCard>
    )
}

// Tela 10.1 (N.5): entrada do painel admin. Saúde dos componentes no topo e, abaixo,
// o estado do mercado, do tempo, da negociação e dos usuários, atualizados sozinhos.
// Cada fonte falha sozinha: o backend devolve `null` na seção que caiu, e a tela
// mostra o motivo naquele cartão sem derrubar os outros.
export function AdminVisaoGeral() {
    const healthQuery = useSystemHealthQuery()
    const overviewQuery = useAdminOverviewQuery()

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Visão geral</h1>
            <p className={styles.subtitle}>Saúde do sistema e estado da simulação. Atualiza sozinha a cada poucos segundos.</p>

            {healthQuery.data ? (
                <SystemHealthStrip components={healthQuery.data.components} />
            ) : healthQuery.isError ? (
                <p className={styles.error} role="alert">
                    Não foi possível consultar a saúde do sistema. O backend pode estar fora do ar.
                </p>
            ) : (
                <p className={styles.loading}>Consultando a saúde do sistema...</p>
            )}

            {overviewQuery.data ? (
                <div className={styles.grid}>
                    <MarketCard overview={overviewQuery.data} />
                    <TimeCard overview={overviewQuery.data} />
                    <TradingCard overview={overviewQuery.data} />
                    <UsersCard overview={overviewQuery.data} />
                    <RetentionCard />
                </div>
            ) : overviewQuery.isError ? (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o resumo do painel.
                </p>
            ) : (
                <p className={styles.loading}>Carregando o resumo...</p>
            )}
        </main>
    )
}
