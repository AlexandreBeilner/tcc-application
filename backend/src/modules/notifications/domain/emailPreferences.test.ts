import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EMAIL_PREFERENCES,
  isCategoryEnabled,
  isEligibleForOptionalEmail,
} from './emailPreferences'

describe('preferências de e-mail', () => {
  it('nasce com social e engajamento desligados (D8)', () => {
    expect(DEFAULT_EMAIL_PREFERENCES).toEqual({ social: false, engagement: false })
  })

  it('categorias opcionais seguem a preferência; segurança e transacional são sempre ligadas', () => {
    const prefs = { social: true, engagement: false }
    expect(isCategoryEnabled(prefs, 'social')).toBe(true)
    expect(isCategoryEnabled(prefs, 'engagement')).toBe(false)
    expect(isCategoryEnabled(DEFAULT_EMAIL_PREFERENCES, 'security')).toBe(true)
    expect(isCategoryEnabled(DEFAULT_EMAIL_PREFERENCES, 'transactional')).toBe(true)
  })

  it.each([
    [{ address: 'ana@exemplo.com', status: 'active', emailVerified: true }, true],
    [{ address: 'ana@exemplo.com', status: 'suspended', emailVerified: true }, false],
    [{ address: 'ana@exemplo.com', status: 'active', emailVerified: false }, false],
    [
      { address: 'usuario-removido-1@anonimo.invalid', status: 'active', emailVerified: true },
      false,
    ],
  ] as const)('elegibilidade %j => %s', (recipient, expected) => {
    expect(isEligibleForOptionalEmail(recipient)).toBe(expected)
  })
})
