// Chaves de localStorage tinham o prefixo `tcc.` (nome de projeto de
// desenvolvimento, visível no DevTools). As chaves novas usam `app.`; a leitura
// ainda aceita a chave antiga uma vez e migra o valor, para quem já estava
// logado (ou tinha tema/notícias vistas) não perder o estado na atualização.
// Este módulo é o único lugar que cita as chaves antigas (fora da varredura de
// conteúdo visível, que ignora `utils/storage`).

export const STORAGE_KEYS = {
    theme: { current: 'app.theme', legacy: 'tcc.theme' },
    authToken: { current: 'app.auth.token', legacy: 'tcc.auth.token' },
    lastSeenNewsId: { current: 'app.news.lastSeenId', legacy: 'tcc.news.lastSeenId' },
    // Assembleias abertas já vistas em Notícias (MO.6.6): JSON de ids, só para acender o sino.
    assembliesSeen: { current: 'app.assemblies.seen', legacy: 'tcc.assemblies.seen' },
    // Convites ao PRO dispensados (MO.5.5): JSON { [contexto]: timestamp }. A chave `tcc.` nunca existiu
    // (o tipo exige o par); a leitura dela é inofensiva.
    proInviteDismissed: { current: 'app.proInvite.dismissed', legacy: 'tcc.proInvite.dismissed' },
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export function readStored(key: StorageKey): string | null {
    const current = localStorage.getItem(key.current)
    if (current !== null) {
        return current
    }
    const legacy = localStorage.getItem(key.legacy)
    if (legacy === null) {
        return null
    }
    localStorage.setItem(key.current, legacy)
    localStorage.removeItem(key.legacy)
    return legacy
}

export function writeStored(key: StorageKey, value: string): void {
    localStorage.setItem(key.current, value)
    localStorage.removeItem(key.legacy)
}

export function removeStored(key: StorageKey): void {
    localStorage.removeItem(key.current)
    localStorage.removeItem(key.legacy)
}
