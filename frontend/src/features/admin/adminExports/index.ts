import { ApiError } from '../../../services/client'
import type { ExportDataset, ExportFilters } from '../../../services/admin'

export const EXPORT_MAX_ROWS = 50_000

export const EXPORT_DATASETS: Array<{ value: ExportDataset; label: string; hint: string }> = [
    {
        value: 'users',
        label: 'Usuários',
        hint: 'Nome, e-mail, usuário, papel, estado e data de cadastro. Nunca senha, patrimônio nem rentabilidade. Contém dado pessoal e pede sua senha.',
    },
    { value: 'orders', label: 'Ordens', hint: 'Ordens do livro (inclusive de bots), identificando a conta só pelo id.' },
    {
        value: 'market-events',
        label: 'Eventos de mercado',
        hint: 'O log imutável de movimentações (compras, vendas, proventos), identificando a conta só pelo id.',
    },
    { value: 'audit-log', label: 'Auditoria', hint: 'O log de ações do painel, com quem fez, o quê e o resultado.' },
]

export interface ExportFormValues {
    dataset: ExportDataset
    from: string
    to: string
    limit: string
}

export const EMPTY_EXPORT_FORM: ExportFormValues = { dataset: 'orders', from: '', to: '', limit: '' }

function toIso(value: string): string | undefined {
    if (value.trim() === '') return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

// Primeiro problema que impede o download, ou `null`.
export function validateExportForm(values: ExportFormValues): string | null {
    const from = toIso(values.from)
    const to = toIso(values.to)
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) return 'O início do período não pode ser depois do fim.'
    if (values.limit.trim() !== '') {
        const limit = Number(values.limit)
        if (!Number.isInteger(limit) || limit < 1) return 'O limite de linhas precisa ser um número inteiro positivo.'
    }
    return null
}

export function buildExportFilters(values: ExportFormValues): ExportFilters {
    const filters: ExportFilters = {}
    const from = toIso(values.from)
    const to = toIso(values.to)
    if (from) filters.from = from
    if (to) filters.to = to
    if (values.limit.trim() !== '') filters.limit = Math.min(Number(values.limit), EXPORT_MAX_ROWS)
    return filters
}

// O `<a href>` não leva o Bearer, então o arquivo é baixado como blob e entregue ao navegador.
export function saveBlobAsFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

export function describeExportError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 400) return 'O servidor recusou o filtro: confira o período e o limite.'
        if (err.status === 401) return 'Sua senha não foi confirmada. A exportação de usuários exige senha recente.'
    }
    return 'Não foi possível gerar o arquivo agora. Tente novamente em instantes.'
}
