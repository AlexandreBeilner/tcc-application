import { describe, expect, it } from 'vitest'
import { markPrice } from './markPrice'

describe('markPrice', () => {
  it('usa o ponto médio do book quando os dois lados têm oferta', () => {
    expect(markPrice(10.25, 999)).toBe(10.25)
  })

  it('cai pro último preço negociado quando o book não tem os dois lados', () => {
    expect(markPrice(null, 10.5)).toBe(10.5)
  })

  it('um negócio de 1 cota (wash trade) não move a marcação além do ponto médio', () => {
    const midPrice = 10
    expect(markPrice(midPrice, 50)).toBe(midPrice)
    expect(markPrice(midPrice, 0.01)).toBe(midPrice)
  })
})
