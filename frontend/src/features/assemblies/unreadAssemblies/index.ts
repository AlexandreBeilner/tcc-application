import { readStored, STORAGE_KEYS, writeStored } from '../../../utils/storage'

const MAX_REMEMBERED = 100

type Listener = () => void
const listeners = new Set<Listener>()

function parse(raw: string | null): string[] {
    if (!raw) return []
    try {
        const value: unknown = JSON.parse(raw)
        return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
    } catch {
        return []
    }
}

// Ids das assembleias abertas que a pessoa já viu em Notícias. Só acende o sino: o que importa
// (pauta, prazo, direito de voto) vem sempre do servidor.
export function getSeenAssemblyIds(): string[] {
    return parse(readStored(STORAGE_KEYS.assembliesSeen))
}

// Há assembleia aberta que a pessoa ainda não viu em Notícias?
export function hasUnseenAssembly(openIds: readonly string[], seen: readonly string[]): boolean {
    const known = new Set(seen)
    return openIds.some((id) => !known.has(id))
}

export function markAssembliesSeen(ids: readonly string[]): void {
    if (ids.length === 0) return
    const merged = [...new Set([...getSeenAssemblyIds(), ...ids])].slice(-MAX_REMEMBERED)
    writeStored(STORAGE_KEYS.assembliesSeen, JSON.stringify(merged))
    listeners.forEach((listener) => listener())
}

// Mesmo motivo do sino de notícias: o evento `storage` não dispara na própria aba.
export function subscribeToSeenAssemblies(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

// Estável entre renders: `useSyncExternalStore` compara por referência, então o snapshot é a string
// crua do storage, não o array.
export function getSeenAssembliesSnapshot(): string | null {
    return readStored(STORAGE_KEYS.assembliesSeen)
}
