import { readStored, STORAGE_KEYS, writeStored } from '../../../utils/storage'

// Convites ao PRO dispensáveis (MO.5.5). A escolha de dispensar vale por contexto (liga, duelo,
// cosméticos, retrospectiva) durante 30 dias e vive só no navegador; sem localStorage, o convite
// simplesmente volta a aparecer.
export const PRO_INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

export type ProInviteContext = 'league' | 'duel' | 'cosmetics' | 'retrospective'

function readAll(): Partial<Record<ProInviteContext, number>> {
    try {
        const raw = readStored(STORAGE_KEYS.proInviteDismissed)
        const parsed: unknown = raw === null ? null : JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, number>) : {}
    } catch {
        return {}
    }
}

export function isProInviteDismissed(context: ProInviteContext, now: number = Date.now()): boolean {
    const dismissedAt = readAll()[context]
    return typeof dismissedAt === 'number' && now - dismissedAt < PRO_INVITE_SNOOZE_MS
}

export function dismissProInvite(context: ProInviteContext, now: number = Date.now()): void {
    try {
        writeStored(STORAGE_KEYS.proInviteDismissed, JSON.stringify({ ...readAll(), [context]: now }))
    } catch {
        // armazenamento indisponível: o convite some só nesta visita
    }
}
