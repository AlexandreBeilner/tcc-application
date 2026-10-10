import { ApiError } from '../../../services/client'
import type { CatalogAsset, CatalogEditableField, CatalogPatch } from '../../../services/admin'
import type { CatalogClass, CatalogDraft, CatalogFilters } from './types'

export type { CatalogClass, CatalogDraft, CatalogFilters } from './types'

// Filtro, rascunho de edição e rótulos do catálogo (N.12). Funções puras: a tela só apresenta,
// e a regra de cada campo é a do motor (aqui só o formato e os mesmos limites, pra recusar
// antes de chamar a rede; o motor valida de novo).

export const CLASS_LABELS: Record<CatalogClass, string> = {
    acao: 'Ações',
    fii: 'FIIs',
    etf: 'ETFs',
    renda_fixa: 'Renda fixa',
}

const TYPE_LABELS: Record<string, string> = {
    acao: 'Ação',
    fii: 'FII',
    etf: 'ETF',
    tesouro_selic: 'Tesouro Selic',
    tesouro_prefixado: 'Tesouro Prefixado',
    tesouro_ipca: 'Tesouro IPCA+',
    cdb: 'CDB',
    lci: 'LCI',
    lca: 'LCA',
    cri: 'CRI',
    cra: 'CRA',
}

export function catalogTypeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type
}

export function catalogClassOf(type: string): CatalogClass {
    if (type === 'acao' || type === 'fii' || type === 'etf') return type
    return 'renda_fixa'
}

export function filterCatalog(assets: CatalogAsset[], filters: CatalogFilters): CatalogAsset[] {
    const query = filters.query.trim().toLowerCase()
    return assets.filter(
        (a) =>
            (filters.klass === 'all' || catalogClassOf(a.type) === filters.klass) &&
            (query === '' || a.ticker.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)),
    )
}

export const FIELD_LABELS: Record<CatalogEditableField, string> = {
    name: 'Nome',
    base_growth_pct: 'Crescimento base por ciclo (%)',
    quality_multiplier: 'Multiplicador de qualidade',
    methodology_summary: 'Metodologia',
}

// O que cada campo afeta, pra tela avisar antes de salvar.
export const FIELD_HINTS: Record<CatalogEditableField, string> = {
    name: 'Só o nome exibido. O ticker não muda.',
    base_growth_pct: 'Vale pra empresa emissora (ON e PN). Maior crescimento sustenta um preço justo mais alto nos próximos relatórios.',
    quality_multiplier: 'De 0 (exclusive) a 2. 1 é a média do setor; acima, mais margem e menos dívida. Vale pra ON e PN.',
    methodology_summary: 'Texto mostrado na tela de detalhe do ETF. Vazio remove.',
}

const FIELD_ORDER: CatalogEditableField[] = ['name', 'base_growth_pct', 'quality_multiplier', 'methodology_summary']

export function orderedEditableFields(asset: CatalogAsset): CatalogEditableField[] {
    return FIELD_ORDER.filter((field) => asset.editable.includes(field))
}

function numberText(value: number): string {
    return String(value).replace('.', ',')
}

export function draftFromAsset(asset: CatalogAsset): CatalogDraft {
    return {
        name: asset.name,
        base_growth_pct: asset.company ? numberText(asset.company.base_growth_pct) : '',
        quality_multiplier: asset.company ? numberText(asset.company.quality_multiplier) : '',
        methodology_summary: asset.etf?.methodology_summary ?? '',
    }
}

export function parseDecimal(raw: string): number | null {
    const text = raw.trim()
    if (!/^-?\d+([.,]\d+)?$/.test(text)) return null
    return Number(text.replace(',', '.'))
}

export const MAX_NAME_LENGTH = 100
export const MAX_METHODOLOGY_LENGTH = 1000

// Valida só os campos editáveis do ativo e devolve apenas os que mudaram. `errors` é por campo.
export function buildCatalogPatch(
    asset: CatalogAsset,
    draft: CatalogDraft,
): { patch: CatalogPatch; errors: Partial<Record<CatalogEditableField, string>> } {
    const patch: CatalogPatch = {}
    const errors: Partial<Record<CatalogEditableField, string>> = {}
    const initial = draftFromAsset(asset)

    for (const field of orderedEditableFields(asset)) {
        if (draft[field] === initial[field]) continue
        if (field === 'name') {
            const name = draft.name.trim()
            if (name === '' || name.length > MAX_NAME_LENGTH) errors.name = `Use de 1 a ${MAX_NAME_LENGTH} caracteres.`
            else if (name !== asset.name) patch.name = name
        } else if (field === 'base_growth_pct') {
            const value = parseDecimal(draft.base_growth_pct)
            if (value === null) errors.base_growth_pct = 'Digite um número, como 3 ou 6,5.'
            else if (value <= -100) errors.base_growth_pct = 'Precisa ser maior que -100%, senão o fator de crescimento zera.'
            else if (value !== asset.company?.base_growth_pct) patch.base_growth_pct = value
        } else if (field === 'quality_multiplier') {
            const value = parseDecimal(draft.quality_multiplier)
            if (value === null) errors.quality_multiplier = 'Digite um número, como 1 ou 1,2.'
            else if (value <= 0 || value > 2) errors.quality_multiplier = 'Use um valor maior que 0 e até 2.'
            else if (value !== asset.company?.quality_multiplier) patch.quality_multiplier = value
        } else if (draft.methodology_summary.length > MAX_METHODOLOGY_LENGTH) {
            errors.methodology_summary = `No máximo ${MAX_METHODOLOGY_LENGTH} caracteres.`
        } else {
            patch.methodology_summary = draft.methodology_summary.trim()
        }
    }
    return { patch, errors }
}

// Linhas "campo: de X para Y" da confirmação.
export function describePatch(asset: CatalogAsset, patch: CatalogPatch): string[] {
    const lines: string[] = []
    if (patch.name !== undefined) lines.push(`Nome: "${asset.name}" para "${patch.name}"`)
    if (patch.base_growth_pct !== undefined && asset.company)
        lines.push(`Crescimento base: ${numberText(asset.company.base_growth_pct)}% para ${numberText(patch.base_growth_pct)}%`)
    if (patch.quality_multiplier !== undefined && asset.company)
        lines.push(
            `Multiplicador de qualidade: ${numberText(asset.company.quality_multiplier)} para ${numberText(patch.quality_multiplier)}`,
        )
    if (patch.methodology_summary !== undefined) lines.push('Metodologia: texto alterado')
    return lines
}

// O motor devolve a mensagem de domínio no 422 (campo somente leitura, faixa, sandbox).
export function describeCatalogError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 422) return `O motor recusou a alteração: ${err.message}`
        if (err.status === 404) return 'Esse ativo não existe mais no catálogo.'
        if (err.status === 400) return 'Alteração inválida.'
    }
    return 'Não foi possível salvar agora. Confira a auditoria antes de tentar de novo.'
}
