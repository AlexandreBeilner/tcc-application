import { describe, expect, it } from 'vitest'
import { paginate } from './pagination'

describe('paginate', () => {
  it('fatiada a página pedida com o tamanho de página informado', () => {
    const items = Array.from({ length: 25 }, (_, index) => index)

    const result = paginate(items, 2, 10)

    expect(result.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(result.page).toBe(2)
    expect(result.totalEntries).toBe(25)
    expect(result.totalPages).toBe(3)
  })

  it('clampa página acima do intervalo pro último válido', () => {
    const items = Array.from({ length: 5 }, (_, index) => index)

    const result = paginate(items, 99, 10)

    expect(result.page).toBe(1)
    expect(result.items).toEqual(items)
  })

  it('clampa página abaixo de 1 pra 1', () => {
    const items = [1, 2, 3]

    const result = paginate(items, 0, 10)

    expect(result.page).toBe(1)
  })

  it('lista vazia sempre resolve pra página 1 de 1', () => {
    const result = paginate<number>([], 5, 10)

    expect(result.items).toEqual([])
    expect(result.page).toBe(1)
    expect(result.totalEntries).toBe(0)
    expect(result.totalPages).toBe(1)
  })
})
