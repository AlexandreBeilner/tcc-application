import { describe, expect, it } from 'vitest'
import { isOptionalCategory, isUndeliverableAddress, normalizeAddress, streamFor } from './emailMessage'

describe('emailMessage', () => {
  it.each([
    ['security', false],
    ['transactional', false],
    ['social', true],
    ['engagement', true],
  ] as const)('categoria %s opcional=%s', (category, expected) => {
    expect(isOptionalCategory(category)).toBe(expected)
  })

  it('normaliza espaço e caixa', () => {
    expect(normalizeAddress('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com')
  })

  it.each([
    ['usuario-removido-abc@anonimo.invalid', true],
    ['x@invalid', true],
    ['x@sub.dominio.invalid', true],
    ['ana@exemplo.com', false],
    ['ana@invalid.com', false],
  ])('%s indisponível=%s', (address, expected) => {
    expect(isUndeliverableAddress(address)).toBe(expected)
  })
})

describe('streamFor', () => {
  it('só social e engajamento saem pelo fluxo news', () => {
    expect(streamFor('security')).toBe('transactional')
    expect(streamFor('transactional')).toBe('transactional')
    expect(streamFor('social')).toBe('news')
    expect(streamFor('engagement')).toBe('news')
  })
})
