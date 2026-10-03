import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { AdminBotsTable } from '../../components/organisms/AdminBotsTable'
import { BotActivityPanel } from '../../components/organisms/BotActivityPanel'
import { BotCoverageEditor } from '../../components/organisms/BotCoverageEditor'
import { BotCreateForm } from '../../components/organisms/BotCreateForm'
import { BotHealthPanel } from '../../components/organisms/BotHealthPanel'
import { describeBotError, parseNumber, toCreateInput } from '../../features/admin/botForm'
import type { BotFormValues } from '../../features/admin/botForm'
import { ARCHETYPES, ARCHETYPE_LABELS, describeArchetype, shortBotId } from '../../features/admin/botLabels'
import { useCreateAdminBotMutation, useUpdateAdminBotMutation } from '../../features/admin/useAdminBotActions'
import { useAdminBotActivityQuery } from '../../features/admin/useAdminBotActivityQuery'
import { useAdminBotsQuery } from '../../features/admin/useAdminBotsQuery'
import { useAdminBotsSummaryQuery } from '../../features/admin/useAdminBotsSummaryQuery'
import type { AdminBot, BotAssetRef } from '../../services/admin'
import styles from './index.module.css'

type Pending = { kind: 'deactivate'; bot: AdminBot } | { kind: 'coverage'; bot: AdminBot } | null

const ARCHETYPE_FILTER_OPTIONS: SelectOption[] = [
    { value: '', label: 'Todos os arquétipos' },
    ...ARCHETYPES.map((value) => ({ value, label: ARCHETYPE_LABELS[value] })),
]

const STATUS_FILTER_OPTIONS: SelectOption[] = [
    { value: '', label: 'Ativos e inativos' },
    { value: 'active', label: 'Só ativos' },
    { value: 'inactive', label: 'Só inativos' },
]

const sortByTicker = (a: BotAssetRef, b: BotAssetRef) => a.ticker.localeCompare(b.ticker)

// Tela 10.10 (N.2, N.14) — "Bots" do painel: quem dá liquidez ao mercado. Saúde dos bots (parados,
// sem caixa, Market Maker sem ações), lista com escopo, caixa, posições e cobertura de Market
// Maker, desempenho por bot; ativar e desativar; criação de bot novo; edição da cobertura e do
// teto do Market Maker. Desktop: lista à esquerda e formulário fixo à direita.
// Tablet e mobile: o formulário abre pelo botão "Novo bot".
export function AdminBots() {
    const [archetypeFilter, setArchetypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [formKey, setFormKey] = useState(0)
    const [pending, setPending] = useState<Pending>(null)
    const [selected, setSelected] = useState<string[]>([])
    const [maxCovered, setMaxCovered] = useState('')
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [createError, setCreateError] = useState<string | null>(null)
    const [activityBotId, setActivityBotId] = useState<string | null>(null)
    const [activityDays, setActivityDays] = useState(30)

    const botsQuery = useAdminBotsQuery()
    const summaryQuery = useAdminBotsSummaryQuery()
    const activityQuery = useAdminBotActivityQuery(activityBotId, activityDays)
    const create = useCreateAdminBotMutation()
    const update = useUpdateAdminBotMutation()

    const bots = useMemo(() => botsQuery.data?.bots ?? [], [botsQuery.data])
    const uncovered = useMemo(() => botsQuery.data?.uncovered_assets ?? [], [botsQuery.data])

    const visible = useMemo(
        () =>
            bots.filter(
                (bot) =>
                    (archetypeFilter === '' || bot.archetype === archetypeFilter) &&
                    (statusFilter === '' || (statusFilter === 'active') === bot.is_active),
            ),
        [bots, archetypeFilter, statusFilter],
    )
    const activeCount = bots.filter((bot) => bot.is_active).length

    function handleCreate(values: BotFormValues) {
        setNotice(null)
        setCreateError(null)
        create.mutate(toCreateInput(values), {
            onSuccess: (bot) => {
                setNotice(
                    `${describeArchetype(bot.archetype)} ${shortBotId(bot.account_id)} criado. Entra na próxima rodada de negociação.`,
                )
                setFormKey((key) => key + 1)
                setFormOpen(false)
            },
            onError: (err) => setCreateError(describeBotError(err)),
        })
    }

    function activate(bot: AdminBot) {
        setNotice(null)
        setError(null)
        update.mutate(
            { botId: bot.account_id, input: { is_active: true } },
            {
                onSuccess: () =>
                    setNotice(`${describeArchetype(bot.archetype)} ${shortBotId(bot.account_id)} ativado. Volta na próxima rodada.`),
                onError: (err) => setError(describeBotError(err)),
            },
        )
    }

    function confirmDeactivate() {
        if (pending?.kind !== 'deactivate') return
        const { bot } = pending
        setNotice(null)
        setError(null)
        update.mutate(
            { botId: bot.account_id, input: { is_active: false } },
            {
                onSuccess: () =>
                    setNotice(
                        `${describeArchetype(bot.archetype)} ${shortBotId(bot.account_id)} desativado. Caixa e posições foram mantidos.`,
                    ),
                onError: (err) => setError(describeBotError(err)),
                onSettled: () => setPending(null),
            },
        )
    }

    function openCoverage(bot: AdminBot) {
        setSelected(bot.covered_assets.map((asset) => asset.asset_id))
        setMaxCovered(String(bot.max_covered_assets ?? ''))
        setPending({ kind: 'coverage', bot })
    }

    const coverageBot = pending?.kind === 'coverage' ? pending.bot : null
    const coverageOptions = useMemo(() => {
        if (!coverageBot) return []
        const byId = new Map<string, BotAssetRef>()
        for (const asset of [...coverageBot.covered_assets, ...uncovered]) byId.set(asset.asset_id, asset)
        return [...byId.values()].sort(sortByTicker)
    }, [coverageBot, uncovered])

    const maxParsed = parseNumber(maxCovered)
    const maxError = !coverageBot
        ? null
        : !Number.isInteger(maxParsed) || maxParsed < 1
          ? 'Use um número inteiro maior que 0.'
          : selected.length > maxParsed
            ? `Há ${selected.length} ativos selecionados, acima do teto.`
            : null
    const removedTickers = coverageBot
        ? coverageBot.covered_assets.filter((asset) => !selected.includes(asset.asset_id)).map((a) => a.ticker)
        : []

    function confirmCoverage() {
        if (!coverageBot || maxError) return
        const currentIds = coverageBot.covered_assets.map((asset) => asset.asset_id)
        const coverageChanged = selected.length !== currentIds.length || selected.some((id) => !currentIds.includes(id))
        const maxChanged = maxParsed !== coverageBot.max_covered_assets
        if (!coverageChanged && !maxChanged) {
            setPending(null)
            setNotice('Nada a alterar: a cobertura e o teto já são esses.')
            return
        }
        setNotice(null)
        setError(null)
        update.mutate(
            {
                botId: coverageBot.account_id,
                input: {
                    ...(maxChanged ? { max_covered_assets: maxParsed } : {}),
                    ...(coverageChanged ? { covered_asset_ids: selected } : {}),
                },
            },
            {
                onSuccess: () =>
                    setNotice(
                        removedTickers.length > 0
                            ? `Cobertura atualizada. As ordens do Market Maker em ${removedTickers.join(', ')} foram canceladas.`
                            : 'Cobertura atualizada.',
                    ),
                onError: (err) => setError(describeBotError(err)),
                onSettled: () => setPending(null),
            },
        )
    }

    function toggleActivity(bot: AdminBot) {
        setActivityBotId((current) => (current === bot.account_id ? null : bot.account_id))
    }

    // Do painel de saúde, abre o desempenho e limpa os filtros pra o bot aparecer na lista.
    function openActivityFromHealth(botId: string) {
        setArchetypeFilter('')
        setStatusFilter('')
        setActivityBotId(botId)
    }

    const updatingId = update.isPending ? (update.variables?.botId ?? null) : null

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Bots</h1>
                    <p className={styles.subtitle}>
                        Os bots dão liquidez ao mercado: negociam nos dois lados do book e movem o preço só por negociação. Aqui você ativa,
                        desativa, cria e reatribui a cobertura dos Market Makers.
                    </p>
                </div>
                <Link to="/admin/mercado" className={styles.link}>
                    Ir ao monitor do mercado
                </Link>
            </header>

            {botsQuery.data && (
                <p className={styles.summary}>
                    {activeCount} de {bots.length} bots ativos
                </p>
            )}

            {uncovered.length > 0 && (
                <section className={styles.warning} aria-label="Ativos sem cobertura">
                    <h2 className={styles.warningTitle}>
                        {uncovered.length} {uncovered.length === 1 ? 'ativo sem Market Maker ativo' : 'ativos sem Market Maker ativo'}
                    </h2>
                    <p className={styles.warningText}>{uncovered.map((asset) => asset.ticker).join(', ')}</p>
                    <p className={styles.warningText}>
                        Sem cotação contínua, o book desses ativos pode ficar vazio. Adicione-os à cobertura de um Market Maker ou crie um
                        novo.
                    </p>
                </section>
            )}

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

            {summaryQuery.data && <BotHealthPanel summary={summaryQuery.data} onOpenActivity={openActivityFromHealth} />}

            <div className={styles.layout}>
                <section className={styles.main} aria-label="Lista de bots">
                    <div className={styles.toolbar}>
                        <div className={styles.filters}>
                            <Select
                                aria-label="Filtrar por arquétipo"
                                value={archetypeFilter}
                                options={ARCHETYPE_FILTER_OPTIONS}
                                onChange={setArchetypeFilter}
                            />
                            <Select
                                aria-label="Filtrar por status"
                                value={statusFilter}
                                options={STATUS_FILTER_OPTIONS}
                                onChange={setStatusFilter}
                            />
                        </div>
                        <Button
                            variant="secondary"
                            className={styles.newButton}
                            onClick={() => setFormOpen((open) => !open)}
                            aria-expanded={formOpen}
                        >
                            {formOpen ? 'Fechar formulário' : 'Novo bot'}
                        </Button>
                    </div>

                    {botsQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar os bots agora. Tente novamente em instantes.
                        </p>
                    )}
                    {botsQuery.isLoading && <p className={styles.loading}>Carregando bots…</p>}
                    {botsQuery.data && (
                        <AdminBotsTable
                            bots={visible}
                            updatingId={updatingId}
                            onToggle={(bot) => (bot.is_active ? setPending({ kind: 'deactivate', bot }) : activate(bot))}
                            onEditCoverage={openCoverage}
                            emptyMessage={bots.length === 0 ? 'Nenhum bot cadastrado ainda.' : 'Nenhum bot com esses filtros.'}
                            expandedId={activityBotId}
                            onToggleActivity={toggleActivity}
                            renderDetail={() => (
                                <BotActivityPanel
                                    activity={activityQuery.data}
                                    isLoading={activityQuery.isLoading}
                                    isError={activityQuery.isError}
                                    days={activityDays}
                                    onDaysChange={setActivityDays}
                                />
                            )}
                        />
                    )}
                </section>

                <aside className={formOpen ? `${styles.formPanel} ${styles.formPanelOpen}` : styles.formPanel} aria-label="Criar bot">
                    <h2 className={styles.sectionTitle}>Novo bot</h2>
                    <BotCreateForm key={formKey} onSubmit={handleCreate} pending={create.isPending} errorMessage={createError} />
                </aside>
            </div>

            {pending?.kind === 'deactivate' && (
                <ConfirmDialog
                    title={`Desativar ${describeArchetype(pending.bot.archetype)} ${shortBotId(pending.bot.account_id)}?`}
                    confirmLabel="Desativar"
                    pendingLabel="Desativando…"
                    pending={update.isPending}
                    onConfirm={confirmDeactivate}
                    onCancel={() => setPending(null)}
                >
                    <p>O bot sai da próxima rodada de negociação. Caixa e posições ficam como estão, nada é vendido nem zerado.</p>
                    {pending.bot.max_covered_assets !== null && (
                        <p>
                            Um Market Maker inativo deixa de contar como cobertura: as cotações dele expiram no próximo tick e os ativos que
                            ele cobre ficam sem Market Maker ativo até você reativá-lo ou reatribuí-los.
                        </p>
                    )}
                    <p>A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
            {coverageBot && (
                <ConfirmDialog
                    title={`Cobertura de ${shortBotId(coverageBot.account_id)}`}
                    confirmLabel="Salvar cobertura"
                    pendingLabel="Salvando…"
                    pending={update.isPending}
                    onConfirm={confirmCoverage}
                    onCancel={() => setPending(null)}
                >
                    <BotCoverageEditor
                        options={coverageOptions}
                        selected={selected}
                        onSelectedChange={setSelected}
                        maxCovered={maxCovered}
                        onMaxCoveredChange={setMaxCovered}
                        maxError={maxError}
                    />
                    {removedTickers.length > 0 && (
                        <p className={styles.dialogWarning}>
                            Ao salvar, as ordens em repouso deste Market Maker em {removedTickers.join(', ')} serão canceladas. A posição
                            que ele tem nesses ativos continua com ele.
                        </p>
                    )}
                </ConfirmDialog>
            )}
        </main>
    )
}
