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
    // mesmo que o último preço negociado tenha sido manipulado por um
    // negócio isolado de 1 cota, o ponto médio do book (sustentado por
    // ordens reais em repouso) segue sendo a marcação — o último preço só
    // entra quando falta um lado do book.
    const midPrice = 10
    expect(markPrice(midPrice, 50)).toBe(midPrice)
    expect(markPrice(midPrice, 0.01)).toBe(midPrice)
  })
})
