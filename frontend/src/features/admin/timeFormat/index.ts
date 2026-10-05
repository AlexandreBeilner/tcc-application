const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
})

// Data/hora no fuso do navegador; null (nunca houve) vira o traço de placeholder
// de dado, que a regra de UI isenta (`—` só é proibido como pontuação de texto).
export function formatDateTime(iso: string | null): string {
    return iso ? dateTimeFormatter.format(new Date(iso)) : '—'
}

export function formatDuration(ms: number): string {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`
}
