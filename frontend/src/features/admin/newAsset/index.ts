import { ApiError } from '../../../services/client'
import type { NewCatalogAsset, NewCatalogAssetKind } from '../../../services/admin'
import { parseDecimal } from '../catalog'
import { MACRO_EVENT_SECTORS } from '../targetOptions'

// Rascunho, validação de formato e mensagens do cadastro de ativo novo (N.13). Funções puras:
// a regra de verdade (faixas, colisão de ticker, constituinte inexistente) é do motor, que
// valida de novo; aqui só se evita a ida à rede por erro óbvio de digitação.

export const NEW_ASSET_KINDS: NewCatalogAssetKind[] = ['acao', 'fii_tijolo', 'fii_papel', 'etf']

export const NEW_ASSET_KIND_LABELS: Record<NewCatalogAssetKind, string> = {
    acao: 'Ação',
    fii_tijolo: 'FII de tijolo',
    fii_papel: 'FII de papel',
    etf: 'ETF',
}

export const NEW_ASSET_SECTORS = MACRO_EVENT_SECTORS

export const MIN_OUTSTANDING_SHARES = 1_000_000
export const MAX_OUTSTANDING_SHARES = 2_000_000_000
export const MAX_ETF_HOLDINGS = 30
const WEIGHT_TOLERANCE = 0.01

export interface HoldingDraft {
    ticker: string
    weight_pct: string
}

export interface NewAssetDraft {
    ticker: string
    name: string
    company_name: string
    cnpj: string
    sector: string
    outstanding_shares: string
    base_growth_pct: string
    quality_multiplier: string
    segment: string
    vacancy_rate: string
    indexador: 'CDI' | 'IPCA+'
    benchmark_index: string
    methodology: string
    holdings: HoldingDraft[]
}

export type NewAssetErrors = Record<string, string>

export function defaultNewAssetDraft(): NewAssetDraft {
    return {
        ticker: '',
        name: '',
        company_name: '',
        cnpj: '',
        sector: NEW_ASSET_SECTORS[0],
        outstanding_shares: '',
        base_growth_pct: '3',
        quality_multiplier: '1',
        segment: '',
        vacancy_rate: '5',
        indexador: 'CDI',
        benchmark_index: '',
        methodology: '',
        holdings: [{ ticker: '', weight_pct: '' }],
    }
}

const EQUITY_TICKER = /^[A-Z]{4}[34]$/
const FUND_TICKER = /^[A-Z]{4}11$/

// Converte o rascunho no pedido do motor, ou devolve os erros por campo. Ticker vai em maiúsculas.
export function buildNewAsset(kind: NewCatalogAssetKind, draft: NewAssetDraft): { asset: NewCatalogAsset } | { errors: NewAssetErrors } {
    const errors: NewAssetErrors = {}
    const ticker = draft.ticker.trim().toUpperCase()
    const name = draft.name.trim()

    if (kind === 'acao' ? !EQUITY_TICKER.test(ticker) : !FUND_TICKER.test(ticker)) {
        errors.ticker = kind === 'acao' ? 'Quatro letras e final 3 ou 4, como ABCD3.' : 'Quatro letras e final 11, como ABCD11.'
    }
    if (name === '' || name.length > 100) errors.name = 'Use de 1 a 100 caracteres.'

    const number = (field: keyof NewAssetDraft, message: string, valid: (value: number) => boolean): number => {
        const value = parseDecimal(String(draft[field]))
        if (value === null || !valid(value)) {
            errors[field] = message
            return 0
        }
        return value
    }

    if (kind === 'acao') {
        const companyName = draft.company_name.trim()
        const cnpj = draft.cnpj.replace(/\D/g, '')
        if (companyName === '' || companyName.length > 100) errors.company_name = 'Use de 1 a 100 caracteres.'
        if (cnpj.length !== 14) errors.cnpj = 'O CNPJ tem 14 dígitos.'
        const shares = number(
            'outstanding_shares',
            `Use um inteiro entre ${MIN_OUTSTANDING_SHARES.toLocaleString('pt-BR')} e ${MAX_OUTSTANDING_SHARES.toLocaleString('pt-BR')}.`,
            (v) => Number.isInteger(v) && v >= MIN_OUTSTANDING_SHARES && v <= MAX_OUTSTANDING_SHARES,
        )
        const growth = number('base_growth_pct', 'Precisa ser um número maior que -100.', (v) => v > -100)
        const quality = number('quality_multiplier', 'Use um valor maior que 0 e até 2.', (v) => v > 0 && v <= 2)
        if (Object.keys(errors).length === 0) {
            return {
                asset: {
                    kind,
                    ticker,
                    name,
                    company_name: companyName,
                    cnpj,
                    sector: draft.sector,
                    outstanding_shares: shares,
                    base_growth_pct: growth,
                    quality_multiplier: quality,
                },
            }
        }
    } else if (kind === 'fii_tijolo') {
        const segment = draft.segment.trim()
        if (segment === '' || segment.length > 50) errors.segment = 'Use de 1 a 50 caracteres.'
        const vacancy = number('vacancy_rate', 'A vacância é um percentual de 0 a 100.', (v) => v >= 0 && v <= 100)
        if (Object.keys(errors).length === 0) return { asset: { kind, ticker, name, segment, vacancy_rate: vacancy } }
    } else if (kind === 'fii_papel') {
        if (Object.keys(errors).length === 0) return { asset: { kind, ticker, name, indexador: draft.indexador } }
    } else {
        const benchmark = draft.benchmark_index.trim()
        if (benchmark === '' || benchmark.length > 100) errors.benchmark_index = 'Use de 1 a 100 caracteres.'
        if (draft.methodology.length > 1000) errors.methodology = 'No máximo 1000 caracteres.'
        const holdings: Array<{ ticker: string; weight_pct: number }> = []
        draft.holdings.forEach((row, index) => {
            const rowTicker = row.ticker.trim().toUpperCase()
            const weight = parseDecimal(row.weight_pct)
            if (rowTicker === '' || weight === null || weight <= 0 || weight > 100) {
                errors.holdings = `Linha ${index + 1}: informe o ticker e um peso entre 0 e 100.`
            } else if (holdings.some((h) => h.ticker === rowTicker)) {
                errors.holdings = `${rowTicker} aparece duas vezes.`
            } else {
                holdings.push({ ticker: rowTicker, weight_pct: weight })
            }
        })
        if (!errors.holdings && Math.abs(holdings.reduce((sum, h) => sum + h.weight_pct, 0) - 100) > WEIGHT_TOLERANCE) {
            errors.holdings = 'Os pesos precisam somar 100%.'
        }
        if (Object.keys(errors).length === 0) {
            const methodology = draft.methodology.trim()
            return { asset: { kind, ticker, name, benchmark_index: benchmark, ...(methodology ? { methodology } : {}), holdings } }
        }
    }
    return { errors }
}

// Soma dos pesos digitados, pra tela mostrar quanto falta.
export function holdingsTotal(holdings: HoldingDraft[]): number {
    return holdings.reduce((sum, h) => sum + (parseDecimal(h.weight_pct) ?? 0), 0)
}

export interface NewAssetFailure {
    message: string
    field?: string
    // Preenchido quando o catálogo gravou e a etapa dos bots ou da cobertura falhou.
    assetId?: string
}

// O motor devolve a mensagem de domínio e o campo no 422; o resto tem texto fixo.
export function describeNewAssetError(err: unknown): NewAssetFailure {
    if (err instanceof ApiError) {
        const details = (err.details ?? {}) as { field?: string; asset_id?: string }
        if (err.status === 422) return { message: err.message, field: details.field }
        if (err.status === 409) return { message: err.message, field: 'ticker' }
        if (err.status === 500 && details.asset_id) {
            return {
                message: `O ativo foi criado, mas a distribuição entre os bots ou a cobertura de Market Maker falhou: ${err.message}. Ele aparece sem cobertura em Bots, onde dá pra atribuir um Market Maker.`,
                assetId: details.asset_id,
            }
        }
        if (err.status === 400) return { message: 'Pedido inválido.' }
    }
    return { message: 'Não foi possível concluir agora. Confira a auditoria antes de tentar de novo.' }
}
