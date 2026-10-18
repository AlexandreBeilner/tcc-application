import type { DailyApi } from './api.ts'
import type { Completion, DailyGame, GameProgress, LearnMore, Mode } from './types.ts'

/** O que cada cartão recebe do jogo que o contém. */
export interface CardEnv {
    doc: Document
    game: DailyGame
    mode: Mode
    api: DailyApi
    progress(): GameProgress
    /**
     * Grava o novo estado agora e atualiza abas e resultado depois de `settleMs` (a animação de revelação),
     * para a cor do cartão não aparecer antes de os quadrados virarem.
     */
    commit(next: GameProgress, completion: Completion | undefined, settleMs: number): void
    /** Trata o efeito do erro (sessão expirada, estado a reler) e devolve o texto para a pessoa. */
    fail(e: unknown): string
    say(message: string): void
    reduced(): boolean
    learnMoreHref(l: NonNullable<LearnMore>): string | null
    later(fn: () => void, ms: number): void
    /** Texto do botão que leva ao próximo cartão (ou ao resultado) e a ação dele. */
    nextLabel(): string
    next(): void
}

export interface CardView {
    el: HTMLElement
    /** Redesenha a parte que depende do progresso (depois de um `resync`). */
    refresh(): void
    /** Tecla física, quando este é o cartão visível. Devolve `true` se tratou. */
    onKey?(e: KeyboardEvent): boolean
}

export const LEARN_MORE_LABEL = { lesson: 'Ver a lição', glossary: 'Ver no glossário', guide: 'Ler o guia' } as const
