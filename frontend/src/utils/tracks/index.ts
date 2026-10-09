// Currículo fixo de 4 trilhas em sequência (spec 5.1) mais a Trilha F paralela (RC.4.4) — nome/cor vivem como dado estático
// no frontend porque nenhum endpoint devolve o nome da trilha, só o número
// (`GetPublicProfileUseCase.completedTracks: number[]`,
// `GET /social-feed`/`.docs/backend/socialfeed.md`): não é RNF09 (nada de
// patrimônio em jogo), é currículo que não muda por usuário. Extraído de
// `TrackTrophyCase` (F.3) e `RecentActivityFeed` (G.2), que duplicavam o
// mesmo mapeamento cada um com sua própria constante. `ticker` acrescentado
// na O.1 (Hub de trilhas) pra reforçar a identidade "home broker" no card —
// mesma convenção `TRLH{N}` do mockup O.0.
export const TRACKS = [
    { number: 0, name: 'Fundamentos', ticker: 'TRLH0', color: 'var(--color-track-0)', background: 'var(--color-brand-100)' },
    { number: 1, name: 'Renda Fixa', ticker: 'TRLH1', color: 'var(--color-track-1)', background: 'var(--color-gain-100)' },
    { number: 2, name: 'Renda Variável', ticker: 'TRLH2', color: 'var(--color-track-2)', background: 'var(--color-loss-100)' },
    { number: 3, name: 'Estratégia e Tributação', ticker: 'TRLH3', color: 'var(--color-track-3)', background: 'var(--color-gamify-100)' },
    {
        number: 4,
        name: 'Finanças do dia a dia',
        ticker: 'TRLHF',
        color: 'var(--color-track-f)',
        background: 'var(--color-bg-surface-elevated)',
    },
] as const

// Trilhas paralelas (RC.4.4): fora da corrente linear, sempre abertas e sem desbloqueio de
// ativo. Espelha `PARALLEL_TRACK_NUMBERS` de `backend/src/modules/lessons/domain/lesson.ts`.
export const PARALLEL_TRACK_NUMBERS: readonly number[] = [4]

export function isParallelTrack(trackNumber: number): boolean {
    return PARALLEL_TRACK_NUMBERS.includes(trackNumber)
}

export function trackNameFor(trackNumber: number): string | undefined {
    return TRACKS.find((track) => track.number === trackNumber)?.name
}
