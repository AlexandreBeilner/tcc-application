import { beforeEach, describe, expect, it } from 'vitest'
import { buildInviteLink, captureReferralCode, clearReferralCode, normalizeReferralCode } from '.'

describe('referralCode', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    it.each([
        ['abcd2345', 'ABCD2345'],
        [' ABCD2345 ', 'ABCD2345'],
        ['ABCD234', null],
        ['ABCD0234', null],
        ['', null],
        [null, null],
    ])('normaliza %j', (raw, expected) => {
        expect(normalizeReferralCode(raw)).toBe(expected)
    })

    it('guarda o código do link e o devolve numa visita seguinte sem ?ref', () => {
        expect(captureReferralCode('?ref=abcd2345')).toBe('ABCD2345')
        expect(captureReferralCode('')).toBe('ABCD2345')
    })

    it('ignora código de formato inválido', () => {
        expect(captureReferralCode('?ref=curto')).toBeNull()
        expect(captureReferralCode('')).toBeNull()
    })

    it('limpa o código guardado', () => {
        captureReferralCode('?ref=ABCD2345')
        clearReferralCode()
        expect(captureReferralCode('')).toBeNull()
    })

    it('monta o link de convite', () => {
        expect(buildInviteLink('https://app.selucra.com.br', 'ABCD2345')).toBe('https://app.selucra.com.br/login?ref=ABCD2345')
    })
})
