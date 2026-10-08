import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../services/client'
import {
    buildExportFilters,
    describeExportError,
    EMPTY_EXPORT_FORM,
    EXPORT_DATASETS,
    EXPORT_MAX_ROWS,
    saveBlobAsFile,
    validateExportForm,
} from '.'

describe('adminExports', () => {
    it('expõe os 4 conjuntos e só o de usuários avisa de senha e dado pessoal', () => {
        expect(EXPORT_DATASETS.map((d) => d.value)).toEqual(['users', 'orders', 'market-events', 'audit-log'])
        const hints = Object.fromEntries(EXPORT_DATASETS.map((d) => [d.value, d.hint]))
        expect(hints.users).toMatch(/pede sua senha/)
        expect(hints.users).toMatch(/Nunca senha, patrimônio/)
        expect(hints.orders).not.toMatch(/senha/)
    })

    it('valida período invertido e limite que não é inteiro positivo', () => {
        expect(validateExportForm(EMPTY_EXPORT_FORM)).toBeNull()
        expect(validateExportForm({ ...EMPTY_EXPORT_FORM, from: '2026-10-02T10:00', to: '2026-10-01T10:00' })).toMatch(/depois do fim/)
        expect(validateExportForm({ ...EMPTY_EXPORT_FORM, limit: '0' })).toMatch(/inteiro positivo/)
        expect(validateExportForm({ ...EMPTY_EXPORT_FORM, limit: '10' })).toBeNull()
    })

    it('monta só os filtros informados e nunca passa do teto', () => {
        expect(buildExportFilters(EMPTY_EXPORT_FORM)).toEqual({})
        const filters = buildExportFilters({ ...EMPTY_EXPORT_FORM, from: '2026-10-01T10:00', limit: '999999999' })
        expect(filters.from).toBe(new Date('2026-10-01T10:00').toISOString())
        expect(filters.to).toBeUndefined()
        expect(filters.limit).toBe(EXPORT_MAX_ROWS)
    })

    it('mensagens por situação: filtro recusado, senha não confirmada e genérica', () => {
        expect(describeExportError(new ApiError(400, 'x'))).toMatch(/filtro/)
        expect(describeExportError(new ApiError(401, 'reauth_required'))).toMatch(/senha/)
        expect(describeExportError(new Error('x'))).toMatch(/Tente novamente/)
    })

    it('saveBlobAsFile cria o link de download com o nome do arquivo e libera a URL', () => {
        const createObjectURL = vi.fn().mockReturnValue('blob:x')
        const revokeObjectURL = vi.fn()
        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

        saveBlobAsFile(new Blob(['x']), 'orders.csv')

        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect(click).toHaveBeenCalledTimes(1)
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:x')
        expect(document.querySelector('a[download]')).toBeNull()
        click.mockRestore()
        vi.unstubAllGlobals()
    })
})
