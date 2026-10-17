import { DailyApiError } from './api.ts'

export type ErrorKind = 'unauthorized' | 'resync' | 'other'

/** Texto para a pessoa e o que o jogo deve fazer além de avisar. */
export function describeError(e: unknown): { message: string; kind: ErrorKind } {
    if (!(e instanceof DailyApiError)) return { message: 'Algo deu errado. Tente de novo.', kind: 'other' }
    if (e.status === 0) return { message: 'Sem conexão com o servidor. Confira a internet e tente de novo.', kind: 'other' }
    if (e.status === 401) return { message: 'Sua sessão expirou. Entre de novo para continuar.', kind: 'unauthorized' }
    if (e.status === 429) {
        const wait = e.retryAfter ? ` Tente de novo em ${e.retryAfter} s.` : ' Tente de novo em instantes.'
        return { message: `Muitos pedidos em pouco tempo.${wait}`, kind: 'other' }
    }
    if (e.code === 'already_answered') return { message: 'Esse cartão já foi respondido. Mostrando o que está salvo.', kind: 'resync' }
    if (e.code === 'not_found') return { message: 'Esse jogo não está disponível.', kind: 'other' }
    if (e.code === 'not_started') return { message: 'O Diário ainda não estreou.', kind: 'other' }
    if (e.code === 'game_unavailable') return { message: 'Estamos preparando o jogo de hoje. Volte em alguns minutos.', kind: 'other' }
    if (e.status >= 500) return { message: 'O servidor não respondeu direito. Tente de novo em instantes.', kind: 'other' }
    return { message: 'Não foi possível concluir. Tente de novo.', kind: 'other' }
}

export function describeInvalidGuess(reason: unknown): string {
    if (reason === 'wrong_length' || reason === 'invalid_length') return 'O palpite precisa ter o tamanho da palavra.'
    return 'Use só letras.'
}
