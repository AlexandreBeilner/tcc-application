// "Atualizado agora há pouco / há 2 h / há 3 dias". O ranking é recalculado a cada poucas
// horas, então a granularidade mais fina é a hora; menos de 1 h vira "há pouco".
export function formatUpdatedAgo(updatedAtIso: string, now: Date = new Date()): string {
    const elapsedMs = now.getTime() - new Date(updatedAtIso).getTime()
    const hours = Math.floor(elapsedMs / 3_600_000)
    if (hours < 1) return 'Atualizado há pouco'
    if (hours < 24) return `Atualizado há ${hours} h`
    const days = Math.floor(hours / 24)
    return `Atualizado há ${days} ${days === 1 ? 'dia' : 'dias'}`
}
