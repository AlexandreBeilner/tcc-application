// Convenção da tarefa A.1 do backlog de engajamento: uma quebra dupla de
// linha (`\n\n`) dentro de `scenarioText`/`microDecisionPrompt`/`revelationText`
// separa cartões independentes. Nenhuma das 33 lições usa `\n\n` hoje, então
// um texto sem o separador sempre devolve 1 cartão só — comportamento
// idêntico ao `<p>` único de antes da A.1.
export function splitIntoCards(text: string): string[] {
    const cards = text
        .split('\n\n')
        .map((card) => card.trim())
        .filter((card) => card.length > 0)

    return cards.length > 0 ? cards : ['']
}
