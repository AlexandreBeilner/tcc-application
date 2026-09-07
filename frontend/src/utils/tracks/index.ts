// Currículo fixo de 4 trilhas (spec 5.1) — nome/cor vivem como dado estático
// no frontend porque nenhum endpoint devolve o nome da trilha, só o número
// (`GetPublicProfileUseCase.completedTracks: number[]`,
// `GET /social-feed`/`.docs/backend/socialfeed.md`): não é RNF09 (nada de
// patrimônio em jogo), é currículo que não muda por usuário. Extraído de
// `TrackTrophyCase` (F.3) e `RecentActivityFeed` (G.2), que duplicavam o
// mesmo mapeamento cada um com sua própria constante.
export const TRACKS = [
    { number: 0, name: 'Fundamentos', color: 'var(--color-track-0)', background: 'var(--color-brand-100)' },
    { number: 1, name: 'Renda Fixa', color: 'var(--color-track-1)', background: 'var(--color-gain-100)' },
    { number: 2, name: 'Renda Variável', color: 'var(--color-track-2)', background: 'var(--color-loss-100)' },
    { number: 3, name: 'Estratégia e Tributação', color: 'var(--color-track-3)', background: 'var(--color-gamify-100)' },
] as const

export function trackNameFor(trackNumber: number): string | undefined {
    return TRACKS.find((track) => track.number === trackNumber)?.name
}
