import { beforeEach, describe, expect, it } from 'vitest'
import { dismissProInvite, isProInviteDismissed, PRO_INVITE_SNOOZE_MS } from '.'

describe('proInviteDismissal', () => {
    beforeEach(() => localStorage.clear())

    it('começa sem nenhum convite dispensado', () => {
        expect(isProInviteDismissed('league')).toBe(false)
    })

    it('dispensa por contexto, sem afetar os outros', () => {
        dismissProInvite('league', 1000)
        expect(isProInviteDismissed('league', 2000)).toBe(true)
        expect(isProInviteDismissed('duel', 2000)).toBe(false)
    })

    it('volta a aparecer depois de 30 dias', () => {
        dismissProInvite('duel', 1000)
        expect(isProInviteDismissed('duel', 1000 + PRO_INVITE_SNOOZE_MS - 1)).toBe(true)
        expect(isProInviteDismissed('duel', 1000 + PRO_INVITE_SNOOZE_MS)).toBe(false)
    })

    it('ignora valor corrompido no armazenamento', () => {
        localStorage.setItem('app.proInvite.dismissed', '{nao-json')
        expect(isProInviteDismissed('cosmetics')).toBe(false)
        dismissProInvite('cosmetics', 5)
        expect(isProInviteDismissed('cosmetics', 6)).toBe(true)
    })
})
