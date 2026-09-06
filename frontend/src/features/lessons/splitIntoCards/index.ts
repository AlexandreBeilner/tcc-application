import type { Card } from './types'

export type { Card } from './types'

// Convenção da tarefa A.1 do backlog de engajamento: uma quebra dupla de
// linha (`\n\n`) dentro de `scenarioText`/`microDecisionPrompt`/`revelationText`
// separa cartões independentes. Nenhuma das 33 lições usa `\n\n` hoje, então
// um texto sem o separador sempre devolve 1 cartão só — comportamento
// idêntico ao `<p>` único de antes da A.1.
//
// Tarefa A.3 (revelação progressiva): um cartão cujo texto — já sem espaço
// nas bordas — começa com o prefixo `[revelar] ` é um "resultado escondido"
// (`hidden: true`); o prefixo é removido do texto exibido, a UI mostra só um
// botão "Ver resultado" no lugar até o toque.
const HIDDEN_CARD_PREFIX = '[revelar] '

export function splitIntoCards(text: string): Card[] {
    const cards = text
        .split('\n\n')
        .map((card) => card.trim())
        .filter((card) => card.length > 0)
        .map((card) => toCard(card))

    return cards.length > 0 ? cards : [{ text: '', hidden: false }]
}

function toCard(card: string): Card {
    if (!card.startsWith(HIDDEN_CARD_PREFIX)) {
        return { text: card, hidden: false }
    }

    return { text: card.slice(HIDDEN_CARD_PREFIX.length), hidden: true }
}
