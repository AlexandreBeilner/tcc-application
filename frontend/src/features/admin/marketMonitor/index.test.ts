import { describe, expect, it } from 'vitest'
import type { MonitorAsset } from '../../../services/admin'
import { filterMonitorAssets, formatIndicatorValue, indicatorLabel, monitorSectors, sortMonitorAssets } from '.'

function asset(overrides: Partial<MonitorAsset>): MonitorAsset {
    return {
        asset_id: overrides.ticker ?? 'x',
        ticker: 'AAA3',
        name: 'Alfa',
        type: 'acao',
        sector: 'Energia',
        last_price: null,
        daily_change_pct: null,
        best_bid: null,
        best_ask: null,
        spread_pct: null,
        resting_orders: 0,
        bot_resting_orders: 0,
        day_trades: 0,
        day_volume: 0,
        outstanding_shares: null,
        held_by_bots: 0,
        held_by_users: 0,
        covered: true,
        indicator: null,
        ...overrides,
    }
}

const assets = [
    asset({ ticker: 'BBB3', name: 'Beta Energia', daily_change_pct: -2, last_price: 10 }),
    asset({ ticker: 'CCC3', name: 'Gama', sector: 'Varejo', daily_change_pct: 5, last_price: 20 }),
    asset({ ticker: 'DDD11', name: 'Delta ETF', type: 'etf', sector: null }),
    asset({ ticker: 'EEE11', name: 'Epsilon FII', type: 'fii', sector: null, daily_change_pct: 1 }),
]

describe('filterMonitorAssets', () => {
    it('filtra por classe, setor e texto (ticker ou nome)', () => {
        expect(filterMonitorAssets(assets, { type: 'etf', sector: 'all', query: '' }).map((a) => a.ticker)).toEqual(['DDD11'])
        expect(filterMonitorAssets(assets, { type: 'all', sector: 'Varejo', query: '' }).map((a) => a.ticker)).toEqual(['CCC3'])
        expect(filterMonitorAssets(assets, { type: 'all', sector: 'all', query: 'energia' }).map((a) => a.ticker)).toEqual(['BBB3'])
        expect(filterMonitorAssets(assets, { type: 'all', sector: 'all', query: ' eee ' }).map((a) => a.ticker)).toEqual(['EEE11'])
    })

    it('sem filtro devolve tudo', () => {
        expect(filterMonitorAssets(assets, { type: 'all', sector: 'all', query: '' })).toHaveLength(4)
    })
})

describe('sortMonitorAssets', () => {
    it('ordena por variação e deixa sem valor sempre no fim, nas duas direções', () => {
        expect(sortMonitorAssets(assets, 'daily_change_pct', 'desc').map((a) => a.ticker)).toEqual(['CCC3', 'EEE11', 'BBB3', 'DDD11'])
        expect(sortMonitorAssets(assets, 'daily_change_pct', 'asc').map((a) => a.ticker)).toEqual(['BBB3', 'EEE11', 'CCC3', 'DDD11'])
    })

    it('ordena por ticker', () => {
        expect(sortMonitorAssets(assets, 'ticker', 'desc').map((a) => a.ticker)[0]).toBe('EEE11')
    })

    it('não altera a lista original', () => {
        const before = assets.map((a) => a.ticker)
        sortMonitorAssets(assets, 'last_price', 'desc')
        expect(assets.map((a) => a.ticker)).toEqual(before)
    })
})

describe('monitorSectors', () => {
    it('lista os setores sem repetir nem incluir ativo sem setor', () => {
        expect(monitorSectors(assets)).toEqual(['Energia', 'Varejo'])
        expect(
            monitorSectors([asset({ sector: 'Varejo' }), asset({ sector: 'Bancário/Financeiro' }), asset({ sector: 'Agronegócio' })]),
        ).toEqual(['Agronegócio', 'Bancário/Financeiro', 'Varejo'])
    })
})

describe('indicadores por classe', () => {
    it('rotula e formata cada tipo no seu formato', () => {
        expect(indicatorLabel({ kind: 'price_to_earnings', value: 11 })).toBe('P/L')
        expect(formatIndicatorValue({ kind: 'price_to_earnings', value: 11 })).toBe('11,0')
        expect(indicatorLabel({ kind: 'nav_premium_pct', value: -1.5 })).toBe('Ágio/deságio')
        expect(formatIndicatorValue({ kind: 'nav_premium_pct', value: -1.5 })).toBe('−1,5%')
        expect(indicatorLabel({ kind: 'price_to_book', value: 0.9 })).toBe('P/VP')
        expect(formatIndicatorValue({ kind: 'price_to_book', value: 0.9 })).toBe('0,90')
    })
})
