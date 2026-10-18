import { useState } from 'react'
import { INITIAL_BOOK, matchOrder, spreadCents } from '../../../features/lessons/widgets/orderBookMath'
import type { Book, MatchResult, OrderInput, Side } from '../../../features/lessons/widgets/orderBookMath'
import { formatCurrency } from '../../../features/portfolio/format'
import { Button } from '../../atoms/Button'
import type { OrderBookWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { OrderBookWidgetProps } from './types'

const money = (cents: number) => formatCurrency(cents / 100)

const toPositive = (raw: string) => {
    const value = Number(raw.replace(',', '.'))
    return Number.isFinite(value) && value > 0 ? value : 0
}

function describe(order: OrderInput, result: MatchResult): string {
    const verb = order.side === 'buy' ? 'Compra' : 'Venda'
    if (result.filledQty === 0) {
        return result.restingQty > 0
            ? `${verb} limitada não executou: nenhum preço do outro lado servia. As ${result.restingQty} ações ficaram no livro, na fila.`
            : `${verb} não executou: não há ofertas do outro lado.`
    }
    const parts = [`${verb} de ${result.filledQty} ações executada a um preço médio de ${money(result.avgCents ?? 0)}.`]
    if ((result.slippageCents ?? 0) > 0.001) {
        parts.push(`Por varrer mais de um nível, o preço médio ficou ${money(result.slippageCents ?? 0)} pior que o melhor preço.`)
    }
    if (result.restingQty > 0) parts.push(`Sobraram ${result.restingQty} ações, que ficaram no livro como ordem limitada.`)
    if (result.unfilledQty > 0) parts.push(`${result.unfilledQty} ações não executaram: o livro acabou.`)
    return parts.join(' ')
}

// Prévia do que a ordem montada faria no livro de agora, sem enviá-la: o efeito aparece antes do clique.
function describePreview(book: Book, order: OrderInput): string {
    if (order.qty <= 0 || (order.type === 'limit' && !order.limitCents)) return 'Informe uma quantidade e, na limitada, um preço.'
    const result = matchOrder(book, order)
    if (result.filledQty === 0) {
        return result.restingQty > 0
            ? 'Prévia: com esse preço, ninguém aceita agora, e a ordem esperaria na fila.'
            : 'Prévia: não há ofertas do outro lado.'
    }
    const rest = result.restingQty > 0 ? ` e ${result.restingQty} esperariam na fila` : ''
    return `Prévia: executaria ${result.filledQty} ações, a ${money(result.avgCents ?? 0)} em média${rest}.`
}

// Widget `order-book` (RC.3.4e): um livro de ofertas pequeno e didático, só no
// navegador, com dados de exemplo. Compras à esquerda e vendas à direita; o
// aluno envia ordens a mercado ou limitadas e vê o que executa, o preço médio,
// o spread e a fila. Os botões de onda empurram o livro com uma ordem grande.
export function OrderBookWidget({ orderType, limitPrice, onMetrics }: OrderBookWidgetProps) {
    const [book, setBook] = useState<Book>(INITIAL_BOOK)
    const [side, setSide] = useState<Side>('buy')
    const [type, setType] = useState<'market' | 'limit'>(orderType ?? 'market')
    const [qty, setQty] = useState(500)
    const [limit, setLimit] = useState(limitPrice ?? 10)
    const [message, setMessage] = useState('Envie uma ordem para ver o livro se mexer.')

    // Preços onde as ordens da pessoa estão esperando na fila, para marcar no livro.
    const [mine, setMine] = useState<{ bids: number[]; asks: number[] }>({ bids: [], asks: [] })

    const spread = spreadCents(book)
    const draft: OrderInput = { side, type, qty, limitCents: type === 'limit' ? Math.round(limit * 100) : undefined }
    const preview = describePreview(book, draft)

    // `own`: ordem enviada pelo botão "Enviar ordem" (as ondas de compradores e vendedores não são ordens da pessoa).
    const send = (order: OrderInput, own = false) => {
        if (order.qty <= 0 || (order.type === 'limit' && !order.limitCents)) {
            setMessage('Informe uma quantidade e, na ordem limitada, um preço.')
            return
        }
        const result = matchOrder(book, order)
        setBook(result.book)
        if (own && result.restingQty > 0 && order.limitCents !== undefined) {
            const key = order.side === 'buy' ? 'bids' : 'asks'
            setMine((current) => ({ ...current, [key]: [...current[key], order.limitCents as number] }))
        }
        setMessage(describe(order, result))
        // Para a missão: quantas ações a ordem limitada de compra executou na hora (0 se esperou na fila).
        if (own) onMetrics?.({ limitFilledQty: order.side === 'buy' && order.type === 'limit' ? result.filledQty : 0 })
    }

    return (
        <div className={styles.root}>
            <div className={styles.bookGrid}>
                <div>
                    <p className={styles.bookTitle}>Compra (quem quer comprar)</p>
                    <ul className={styles.bookSide} aria-label="Ordens de compra, do maior preço ao menor">
                        {book.bids.map((level) => (
                            <li key={level.priceCents} className={styles.bookBid}>
                                <span>
                                    {money(level.priceCents)}
                                    {mine.bids.includes(level.priceCents) && <em className={styles.mineTag}> sua ordem aqui</em>}
                                </span>
                                <span>{level.qty}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <p className={styles.bookTitle}>Venda (quem quer vender)</p>
                    <ul className={styles.bookSide} aria-label="Ordens de venda, do menor preço ao maior">
                        {book.asks.map((level) => (
                            <li key={level.priceCents} className={styles.bookAsk}>
                                <span>
                                    {money(level.priceCents)}
                                    {mine.asks.includes(level.priceCents) && <em className={styles.mineTag}> sua ordem aqui</em>}
                                </span>
                                <span>{level.qty}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <p className={styles.bookMid}>
                Último negócio: {money(book.lastCents)}. Spread: {spread === null ? 'sem um dos lados' : money(spread)}.
            </p>
            <div className={styles.orderPanel} role="group" aria-label="Sua ordem">
                <p className={styles.panelTitle}>Sua ordem</p>
                <div className={styles.orderRow}>
                    <span className={styles.rowLabel}>Quero</span>
                    <div className={styles.presets} role="group" aria-label="Lado da ordem">
                        <button type="button" className={styles.preset} aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>
                            Comprar
                        </button>
                        <button type="button" className={styles.preset} aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>
                            Vender
                        </button>
                    </div>
                </div>
                <div className={styles.orderRow}>
                    <span className={styles.rowLabel}>Tipo</span>
                    <div className={styles.presets} role="group" aria-label="Tipo da ordem">
                        <button type="button" className={styles.preset} aria-pressed={type === 'market'} onClick={() => setType('market')}>
                            A mercado
                        </button>
                        <button type="button" className={styles.preset} aria-pressed={type === 'limit'} onClick={() => setType('limit')}>
                            Limitada
                        </button>
                    </div>
                </div>
                <p className={styles.hint}>
                    {type === 'market'
                        ? 'A mercado: executa já, ao melhor preço disponível.'
                        : 'Limitada: só executa no preço que você pôs ou melhor. Se não houver, espera na fila.'}
                </p>
                <div className={styles.fields}>
                    <label className={styles.field}>
                        Quantidade de ações
                        <input
                            type="number"
                            min={1}
                            step={100}
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) => setQty(toPositive(e.target.value))}
                        />
                    </label>
                    {type === 'limit' && (
                        <label className={styles.field}>
                            Preço limite (R$)
                            <input
                                type="number"
                                min={0}
                                step={0.05}
                                inputMode="decimal"
                                value={limit}
                                onChange={(e) => setLimit(toPositive(e.target.value))}
                            />
                        </label>
                    )}
                </div>
                <p className={styles.preview}>{preview}</p>
                <Button onClick={() => send(draft, true)}>Enviar ordem</Button>
                <div className={styles.result} aria-live="polite">
                    <p className={styles.headline}>{message}</p>
                </div>
            </div>
            <div className={styles.marketTools} role="group" aria-label="Mexer no mercado">
                <p className={styles.panelTitle}>Mexer no mercado (opcional)</p>
                <div className={styles.presets}>
                    <button type="button" className={styles.preset} onClick={() => send({ side: 'buy', type: 'market', qty: 600 })}>
                        Chega onda de compradores
                    </button>
                    <button type="button" className={styles.preset} onClick={() => send({ side: 'sell', type: 'market', qty: 600 })}>
                        Chega onda de vendedores
                    </button>
                    <button
                        type="button"
                        className={styles.preset}
                        onClick={() => {
                            setBook(INITIAL_BOOK)
                            setMine({ bids: [], asks: [] })
                            setMessage('Livro reiniciado.')
                        }}
                    >
                        Reiniciar o livro
                    </button>
                </div>
            </div>
        </div>
    )
}

export function orderBookSummary(_props: OrderBookWidgetProps): string {
    return 'Livro de ofertas com quatro níveis de compra e quatro de venda: você envia ordens a mercado ou limitadas, ou uma onda de compradores ou vendedores, e vê o que executa, o preço médio, o spread e as ordens que ficam na fila.'
}
