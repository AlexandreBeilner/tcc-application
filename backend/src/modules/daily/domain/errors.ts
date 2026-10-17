// Erros das rotas do Diário. Os de "não existe" são de propósito indistinguíveis entre jogo futuro
// e jogo inexistente (seção 3.6).
export class DailyGameNotFoundError extends Error {}

// Antes da estreia nenhuma rota de jogo funciona; a data vai junto para a página mostrar.
export class DailyNotStartedError extends Error {
  constructor(
    readonly startDate: string,
    readonly startsAt: Date,
  ) {
    super('o Diário ainda não começou')
  }
}

// O dia existe, mas o jogo dele não foi materializado (a agenda não rodou ou o conteúdo sumiu).
export class DailyGameUnavailableError extends Error {}

export type InvalidGuessReason = 'invalid_characters' | 'invalid_length' | 'wrong_length'

// Palpite que não tem o formato de uma palavra deste jogo. Não gasta tentativa.
export class InvalidGuessError extends Error {
  constructor(readonly reason: InvalidGuessReason) {
    super('palpite inválido')
  }
}

// Sequência de letras que não é palavra da lista aceita. Não gasta tentativa.
export class WordNotAcceptedError extends Error {}

export class InvalidChoiceError extends Error {}

export class InvalidOrderError extends Error {}

// Logado, cada cartão tem uma única tentativa válida por jogo (DI.2.2).
export class CardAlreadyAnsweredError extends Error {}

// Sem login o servidor não sabe em que tentativa o Termo está; o cliente precisa informar.
export class AttemptRequiredError extends Error {}
