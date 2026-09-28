import { describe, expect, it } from 'vitest'
import { escapeLikePattern } from './drizzleUserDirectory'

describe('escapeLikePattern', () => {
  it('escapa "_" pra não casar como wildcard de 1 caractere no ILIKE', () => {
    expect(escapeLikePattern('joao_silva')).toBe('joao\\_silva')
  })

  it('escapa "%" pra não casar como wildcard de N caracteres no ILIKE', () => {
    expect(escapeLikePattern('100%joao')).toBe('100\\%joao')
  })

  it('escapa "\\" antes das trocas de "%"/"_" pra não dobrar o escape', () => {
    expect(escapeLikePattern('joao\\_silva')).toBe('joao\\\\\\_silva')
  })

  it('mantém intacta uma query sem caractere especial', () => {
    expect(escapeLikePattern('joaosilva')).toBe('joaosilva')
  })
})
