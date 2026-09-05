import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from '.'

describe('fetchAllPages', () => {
    it('devolve só a página 1 sem buscar mais nada quando totalPages é 1', async () => {
        const fetchPage = vi.fn()

        const result = await fetchAllPages(1, ['a', 'b'], fetchPage)

        expect(result).toEqual(['a', 'b'])
        expect(fetchPage).not.toHaveBeenCalled()
    })

    it('busca as páginas restantes e junta com a primeira, na ordem', async () => {
        const fetchPage = vi.fn(async (page: number) => [`page-${page}`])

        const result = await fetchAllPages(3, ['page-1'], fetchPage)

        expect(result).toEqual(['page-1', 'page-2', 'page-3'])
        expect(fetchPage).toHaveBeenCalledWith(2)
        expect(fetchPage).toHaveBeenCalledWith(3)
    })
})
