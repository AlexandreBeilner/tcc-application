import { describeArchetype, shortBotId } from '../../../features/admin/botLabels'
import { formatCurrency } from '../../../features/portfolio/format'
import type { BotHealthPanelProps } from './types'
import styles from './index.module.css'

export type { BotHealthPanelProps } from './types'

const numberFormatter = new Intl.NumberFormat('pt-BR')
const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const TOP_CONCENTRATION = 5

// Provedores de liquidez em ordem fixa; "usuario" é quem não é bot.
const PROVIDER_LABELS: Record<string, string> = { usuario: 'Usuários' }

function providerLabel(provider: string): string {
    return PROVIDER_LABELS[provider] ?? describeArchetype(provider)
}

// Saúde dos bots (N.14): os casos que pedem atenção (parados, caixa esgotado, Market Maker sem
// ações) em cartões com borda tracejada (atenção, nunca só cor) e, em seção recolhível, quem
// provê a liquidez de cada ativo e a concentração do float. Ativo sem cobertura já aparece no
// aviso da própria tela de bots.
export function BotHealthPanel({ summary, onOpenActivity }: BotHealthPanelProps) {
    const { idle_bots: idle, low_cash_bots: lowCash, empty_inventory: empty } = summary
    const healthy = idle.length === 0 && lowCash.length === 0 && empty.length === 0
    const concentration = summary.float_concentration.slice(0, TOP_CONCENTRATION)

    const botButton = (botId: string, archetype: string) => (
        <button type="button" className={styles.botLink} onClick={() => onOpenActivity(botId)}>
            {describeArchetype(archetype)} {shortBotId(botId)}
        </button>
    )

    return (
        <section className={styles.panel} aria-label="Saúde dos bots">
            <h2 className={styles.title}>Saúde dos bots</h2>

            {healthy ? (
                <p className={styles.healthy} role="status">
                    Nenhum alerta: os {summary.active_bots} bots ativos enviaram ordem nos últimos {summary.idle_days} dias simulados e têm
                    caixa.
                </p>
            ) : (
                <div className={styles.alerts}>
                    {idle.length > 0 && (
                        <div className={styles.alert}>
                            <h3 className={styles.alertTitle}>
                                {idle.length} {idle.length === 1 ? 'bot parado' : 'bots parados'}
                            </h3>
                            <p className={styles.alertHint}>Sem ordem há {summary.idle_days} dias simulados ou mais.</p>
                            <ul className={styles.list}>
                                {idle.map((bot) => (
                                    <li key={bot.account_id}>
                                        {botButton(bot.account_id, bot.archetype)}
                                        <span className={styles.sub}>
                                            {bot.last_order_day === null ? ' nunca enviou' : ` última no dia ${bot.last_order_day}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {lowCash.length > 0 && (
                        <div className={styles.alert}>
                            <h3 className={styles.alertTitle}>
                                {lowCash.length} {lowCash.length === 1 ? 'bot sem caixa' : 'bots sem caixa'}
                            </h3>
                            <p className={styles.alertHint}>
                                Caixa abaixo de 1% do capital aportado. Aporte caixa para ele voltar a comprar.
                            </p>
                            <ul className={styles.list}>
                                {lowCash.map((bot) => (
                                    <li key={bot.account_id}>
                                        {botButton(bot.account_id, bot.archetype)}
                                        <span className={styles.sub}>
                                            {` ${formatCurrency(bot.cash)} de ${formatCurrency(bot.capital)}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {empty.length > 0 && (
                        <div className={styles.alert}>
                            <h3 className={styles.alertTitle}>
                                {empty.length} {empty.length === 1 ? 'cobertura sem ações' : 'coberturas sem ações'}
                            </h3>
                            <p className={styles.alertHint}>Market Maker sem nenhuma ação do ativo não consegue cotar a venda.</p>
                            <ul className={styles.list}>
                                {empty.map((item) => (
                                    <li key={`${item.account_id}-${item.asset_id}`}>
                                        {botButton(item.account_id, 'market_maker')}
                                        <span className={styles.sub}> em {item.ticker}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <details className={styles.details}>
                <summary className={styles.summary}>Liquidez por ativo e concentração do float</summary>
                <div className={styles.columns}>
                    <div>
                        <h3 className={styles.subtitle}>Quem provê a liquidez em repouso</h3>
                        {summary.liquidity.length === 0 ? (
                            <p className={styles.sub}>Nenhuma ordem em repouso agora.</p>
                        ) : (
                            <ul className={styles.list}>
                                {summary.liquidity.map((asset) => (
                                    <li key={asset.asset_id}>
                                        <strong>{asset.ticker}</strong>
                                        <span className={styles.sub}>
                                            {' '}
                                            {Object.entries(asset.resting_by_provider)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(
                                                    ([provider, quantity]) =>
                                                        `${providerLabel(provider)} ${numberFormatter.format(quantity)}`,
                                                )
                                                .join(', ')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                        <h3 className={styles.subtitle}>Maiores concentrações de float em um bot</h3>
                        {concentration.length === 0 ? (
                            <p className={styles.sub}>Nenhum bot com posição agora.</p>
                        ) : (
                            <ul className={styles.list}>
                                {concentration.map((item) => (
                                    <li key={item.asset_id}>
                                        <strong>{item.ticker}</strong>
                                        <span className={styles.sub}>
                                            {` ${describeArchetype(item.top_bot_archetype)} ${shortBotId(item.top_bot_id)} tem ${decimalFormatter.format(item.top_bot_pct)}%, todos os bots ${decimalFormatter.format(item.all_bots_pct)}%`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </details>
        </section>
    )
}
